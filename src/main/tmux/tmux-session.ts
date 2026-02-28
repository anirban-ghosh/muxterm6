/**
 * Orchestrator for a single tmux control mode connection.
 * Owns the protocol parser and command queue.
 * Runs the init sequence and routes notifications to the tmux BrowserWindow.
 */

import { BrowserWindow } from 'electron'
import { TmuxProtocolParser, type TmuxNotification } from './tmux-protocol-parser'
import { TmuxCommandQueue } from './tmux-command-queue'
import { parseTmuxLayout } from './tmux-layout-parser'
import { encodeToHex } from './tmux-escape'
import { TMUX_IPC } from '../../shared/tmux-ipc-channels'
import type { TmuxSessionInfo, TmuxWindowInfo, TmuxPaneInfo } from '../../shared/tmux-types'
import type { SplitNode } from '../../shared/types'
import logger from '../logger'

export class TmuxSession {
  readonly id: string
  readonly triggerPtyId: string
  readonly parser: TmuxProtocolParser
  readonly queue: TmuxCommandQueue

  private triggerWindow: BrowserWindow
  private tmuxWindow: BrowserWindow | null = null
  private writeFn: (data: string) => void
  private sessionName = ''
  private windows: TmuxWindowInfo[] = []
  private outputBuffer: Map<string, string[]> = new Map()
  private scrollbackDelivered = new Set<string>()
  private ready = false

  constructor(
    triggerPtyId: string,
    triggerWindow: BrowserWindow,
    writeFn: (data: string) => void,
    createTmuxWindow: (sessionId: string) => BrowserWindow
  ) {
    this.id = `tmux-${triggerPtyId}`
    this.triggerPtyId = triggerPtyId
    this.triggerWindow = triggerWindow
    this.writeFn = writeFn

    this.parser = new TmuxProtocolParser()
    this.queue = new TmuxCommandQueue(this.parser, writeFn)

    // Set up notification handler
    this.parser.on('notification', (notification: TmuxNotification) => {
      this.handleNotification(notification)
    })

    // Create the tmux window
    this.tmuxWindow = createTmuxWindow(this.id)
    this.tmuxWindow.on('closed', () => {
      this.tmuxWindow = null
    })

    // Start init sequence once tmux window is ready
    this.tmuxWindow.webContents.on('did-finish-load', () => {
      this.initialize()
    })
  }

  /**
   * Feed raw data from the control PTY.
   * Returns any remaining raw shell data after %exit, or null.
   */
  feedData(data: string): string | null {
    return this.parser.feed(data)
  }

  /**
   * Send keys to a tmux pane.
   */
  sendKeys(paneId: string, data: string): void {
    const hex = encodeToHex(data)
    this.queue.send(`send-keys -t ${paneId} -H ${hex}`).catch((err) => {
      logger.warn({ paneId, error: err.message }, 'send-keys failed')
    })
  }

  /**
   * Refresh client size.
   */
  refreshClient(cols: number, rows: number): void {
    this.queue.send(`refresh-client -C ${cols}x${rows}`).catch((err) => {
      logger.warn({ error: err.message }, 'refresh-client failed')
    })
  }

  /**
   * Create a new tmux window.
   */
  newWindow(): void {
    this.queue.send('new-window').catch((err) => {
      logger.warn({ error: err.message }, 'new-window failed')
    })
  }

  /**
   * Split a pane.
   */
  splitPaneCmd(paneId: string, direction: 'horizontal' | 'vertical'): void {
    const flag = direction === 'vertical' ? '-h' : '-v'
    this.queue.send(`split-window ${flag} -t ${paneId}`).catch((err) => {
      logger.warn({ paneId, error: err.message }, 'split-window failed')
    })
  }

  /**
   * Kill a pane.
   */
  killPane(paneId: string): void {
    this.queue.send(`kill-pane -t ${paneId}`).catch((err) => {
      logger.warn({ paneId, error: err.message }, 'kill-pane failed')
    })
  }

  /**
   * Resize a pane by a relative delta.
   * direction 'x' = horizontal (columns), 'y' = vertical (rows)
   * amount > 0 = grow, amount < 0 = shrink
   */
  resizePane(paneId: string, direction: 'x' | 'y', amount: number): void {
    if (amount === 0) return
    let flag: string
    if (direction === 'x') {
      flag = amount > 0 ? '-R' : '-L'
    } else {
      flag = amount > 0 ? '-D' : '-U'
    }
    const absAmount = Math.abs(amount)
    this.queue.send(`resize-pane -t ${paneId} ${flag} ${absAmount}`).catch((err) => {
      logger.warn({ paneId, error: err.message }, 'resize-pane failed')
    })
  }

  /**
   * Called when a renderer pane reports its actual xterm.js dimensions after FitAddon fits.
   * We store each pane's real cols/rows and recompute the total tmux client size
   * from the layout tree, so tmux pane sizes exactly match xterm.js.
   */
  private paneSizes = new Map<string, { cols: number; rows: number }>()
  private resizeTimer: ReturnType<typeof setTimeout> | null = null
  private lastClientCols = 0
  private lastClientRows = 0
  private layoutChangeTime = 0

  private forceNextResize = false

  paneResized(tmuxPaneId: string, cols: number, rows: number): void {
    const isNewPane = !this.paneSizes.has(tmuxPaneId)
    this.paneSizes.set(tmuxPaneId, { cols, rows })
    this.lastResizedPaneId = tmuxPaneId
    // New panes (e.g. from tab switch) force a refresh even if total size unchanged.
    if (isNewPane) {
      this.forceNextResize = true
    }
    // Suppress re-reports for 300ms after a %layout-change to break feedback loops.
    // But always allow NEW panes to trigger a resize.
    if (!isNewPane) {
      const elapsed = Date.now() - this.layoutChangeTime
      if (elapsed < 300) return
    }
    // Debounce: multiple panes report within the same frame during resize
    if (this.resizeTimer) clearTimeout(this.resizeTimer)
    this.resizeTimer = setTimeout(() => {
      this.resizeTimer = null
      this.computeAndSendClientSize()
    }, 100)
  }

  private lastResizedPaneId: string | null = null

  private computeAndSendClientSize(): void {
    // Find the window containing the most recently resized pane.
    // Can't rely on the 'active' flag since it's only set during init.
    let targetWin = this.windows[0]
    if (this.lastResizedPaneId) {
      for (const win of this.windows) {
        if (this.windowContainsPane(win.rootNode, this.lastResizedPaneId)) {
          targetWin = win
          break
        }
      }
    }
    if (!targetWin?.rootNode) return

    const size = this.computeNodeSize(targetWin.rootNode)
    const force = this.forceNextResize
    this.forceNextResize = false
    if (size.cols > 0 && size.rows > 0 &&
        (force || size.cols !== this.lastClientCols || size.rows !== this.lastClientRows)) {
      this.lastClientCols = size.cols
      this.lastClientRows = size.rows
      this.refreshClient(size.cols, size.rows)
    }
  }

  private windowContainsPane(node: import('../../shared/types').SplitNode | undefined, tmuxPaneId: string): boolean {
    if (!node) return false
    if (node.type === 'leaf') return node.tmuxPaneId === tmuxPaneId
    return this.windowContainsPane(node.first, tmuxPaneId) || this.windowContainsPane(node.second, tmuxPaneId)
  }

  private computeNodeSize(node: import('../../shared/types').SplitNode): { cols: number; rows: number } {
    if (node.type === 'leaf') {
      const tmuxId = node.tmuxPaneId
      if (tmuxId && this.paneSizes.has(tmuxId)) {
        return this.paneSizes.get(tmuxId)!
      }
      // Fallback: return 0 if pane hasn't reported yet
      return { cols: 0, rows: 0 }
    }

    const first = this.computeNodeSize(node.first)
    const second = this.computeNodeSize(node.second)

    if (first.cols === 0 || second.cols === 0) {
      // Not all panes have reported yet — use whichever is available
      return first.cols > 0 ? first : second
    }

    if (node.direction === 'vertical') {
      // Side by side: cols add up + 1 for divider, rows = max
      return {
        cols: first.cols + 1 + second.cols,
        rows: Math.max(first.rows, second.rows)
      }
    } else {
      // Stacked: rows add up + 1 for divider, cols = max
      return {
        cols: Math.max(first.cols, second.cols),
        rows: first.rows + 1 + second.rows
      }
    }
  }

  /**
   * Detach from the tmux session.
   */
  detach(): void {
    this.queue.send('detach-client').catch(() => {
      // May fail if already detaching
    })
  }

  /**
   * Force quit: kill the tmux server/session.
   */
  forceQuit(): void {
    this.writeFn('\x03') // Send Ctrl-C
    this.queue.dispose()
  }

  dispose(): void {
    this.queue.dispose()
    this.parser.reset()
    if (this.tmuxWindow && !this.tmuxWindow.isDestroyed()) {
      this.tmuxWindow.close()
    }
  }

  private async initialize(): Promise<void> {
    try {
      // Get session name
      const sessionLines = await this.queue.send(
        'display-message -p "#{session_name}"'
      )
      this.sessionName = (sessionLines[0] || 'tmux').trim()

      // Notify trigger window
      if (!this.triggerWindow.isDestroyed()) {
        this.triggerWindow.webContents.send(
          TMUX_IPC.DETECTED,
          this.triggerPtyId,
          this.sessionName
        )
      }

      // List windows
      const windowLines = await this.queue.send(
        'list-windows -F "#{window_id} #{window_name} #{window_layout} #{window_active}"'
      )

      this.windows = []
      for (const line of windowLines) {
        const parts = line.split(' ')
        if (parts.length < 4) continue
        const windowId = parts[0]
        const name = parts[1]
        const layout = parts[2]
        const active = parts[3] === '1'

        // List panes for this window
        const paneLines = await this.queue.send(
          `list-panes -t ${windowId} -F "#{pane_id} #{pane_width} #{pane_height} #{pane_active}"`
        )

        const panes: TmuxPaneInfo[] = paneLines.map((pl) => {
          const pp = pl.split(' ')
          return {
            paneId: pp[0],
            width: parseInt(pp[1], 10),
            height: parseInt(pp[2], 10),
            active: pp[3] === '1'
          }
        })

        let rootNode: SplitNode | undefined
        try {
          rootNode = parseTmuxLayout(layout)
        } catch (err) {
          logger.warn({ layout, error: err }, 'failed to parse tmux layout')
        }

        this.windows.push({ windowId, name, layout, active, panes, rootNode })
      }

      // Set a reasonable initial client size BEFORE capturing scrollback,
      // so panes have proper dimensions when captured.
      // Will be updated once renderer reports actual size.
      await this.queue.send('refresh-client -C 200x50').catch(() => {})

      // Capture scrollback for each pane
      const scrollback: Record<string, string> = {}
      for (const win of this.windows) {
        for (const pane of win.panes) {
          try {
            const scrollbackLines = await this.queue.send(
              `capture-pane -t ${pane.paneId} -p -e -S -`
            )
            const data = scrollbackLines.join('\r\n')
            if (data.trim()) {
              scrollback[pane.paneId] = data + '\r\n'
            }
            this.scrollbackDelivered.add(pane.paneId)
          } catch (err) {
            logger.warn({ paneId: pane.paneId, error: err }, 'capture-pane failed')
          }
        }
      }

      // Send session-ready to tmux window (includes scrollback data)
      const sessionInfo: TmuxSessionInfo = {
        sessionId: this.id,
        sessionName: this.sessionName,
        triggerPtyId: this.triggerPtyId,
        windows: this.windows,
        scrollback
      }

      if (this.tmuxWindow && !this.tmuxWindow.isDestroyed()) {
        this.tmuxWindow.webContents.send(TMUX_IPC.SESSION_READY, sessionInfo)
      }

      this.ready = true

      // Flush buffered output
      for (const [paneId, chunks] of this.outputBuffer) {
        if (this.tmuxWindow && !this.tmuxWindow.isDestroyed()) {
          for (const chunk of chunks) {
            this.tmuxWindow.webContents.send(TMUX_IPC.OUTPUT, paneId, chunk)
          }
        }
      }
      this.outputBuffer.clear()

      logger.info(
        { sessionId: this.id, sessionName: this.sessionName, windowCount: this.windows.length },
        'tmux session initialized'
      )
    } catch (err) {
      logger.error({ error: err }, 'tmux session initialization failed')
    }
  }

  private handleNotification(notification: TmuxNotification): void {
    switch (notification.type) {
      case 'output':
        this.handleOutput(notification.paneId!, notification.data!)
        break

      case 'window-add':
        this.handleWindowAdd(notification.windowId!)
        break

      case 'window-close':
        this.handleWindowClose(notification.windowId!)
        break

      case 'window-renamed':
        this.handleWindowRenamed(notification.windowId!, notification.name!)
        break

      case 'layout-change':
        this.handleLayoutChange(notification.windowId!, notification.layout!)
        break

      case 'exit':
        this.handleExit(notification.reason)
        break
    }
  }

  private handleOutput(paneId: string, data: string): void {
    if (!this.ready) {
      // Buffer output until scrollback is delivered
      const buf = this.outputBuffer.get(paneId) || []
      buf.push(data)
      this.outputBuffer.set(paneId, buf)
      return
    }

    if (this.tmuxWindow && !this.tmuxWindow.isDestroyed()) {
      this.tmuxWindow.webContents.send(TMUX_IPC.OUTPUT, paneId, data)
    }
  }

  private async handleWindowAdd(windowId: string): Promise<void> {
    try {
      const lines = await this.queue.send(
        `list-windows -f "#{==:#{window_id},${windowId}}" -F "#{window_id} #{window_name} #{window_layout} #{window_active}"`
      )
      if (lines.length === 0) return

      const parts = lines[0].split(' ')
      const paneLines = await this.queue.send(
        `list-panes -t ${windowId} -F "#{pane_id} #{pane_width} #{pane_height} #{pane_active}"`
      )

      const panes: TmuxPaneInfo[] = paneLines.map((pl) => {
        const pp = pl.split(' ')
        return {
          paneId: pp[0],
          width: parseInt(pp[1], 10),
          height: parseInt(pp[2], 10),
          active: pp[3] === '1'
        }
      })

      let rootNode: SplitNode | undefined
      try {
        rootNode = parseTmuxLayout(parts[2])
      } catch (err) {
        logger.warn({ layout: parts[2], error: err }, 'failed to parse layout for new window')
      }

      const winInfo: TmuxWindowInfo = {
        windowId,
        name: parts[1],
        layout: parts[2],
        active: parts[3] === '1',
        panes,
        rootNode
      }

      this.windows.push(winInfo)

      if (this.tmuxWindow && !this.tmuxWindow.isDestroyed()) {
        this.tmuxWindow.webContents.send(TMUX_IPC.TAB_ADD, winInfo)
      }
    } catch (err) {
      logger.warn({ windowId, error: err }, 'failed to handle window-add')
    }
  }

  private handleWindowClose(windowId: string): void {
    this.windows = this.windows.filter((w) => w.windowId !== windowId)
    if (this.tmuxWindow && !this.tmuxWindow.isDestroyed()) {
      this.tmuxWindow.webContents.send(TMUX_IPC.TAB_CLOSE, windowId)
    }
  }

  private handleWindowRenamed(windowId: string, name: string): void {
    const win = this.windows.find((w) => w.windowId === windowId)
    if (win) win.name = name

    if (this.tmuxWindow && !this.tmuxWindow.isDestroyed()) {
      this.tmuxWindow.webContents.send(TMUX_IPC.TAB_RENAMED, windowId, name)
    }
  }

  private handleLayoutChange(windowId: string, layout: string): void {
    // Mark time so paneResized suppresses feedback loop
    this.layoutChangeTime = Date.now()

    const win = this.windows.find((w) => w.windowId === windowId)
    if (win) {
      win.layout = layout
      try {
        win.rootNode = parseTmuxLayout(layout)
      } catch (err) {
        logger.warn({ layout, error: err }, 'failed to parse layout change')
        return
      }
    }

    if (this.tmuxWindow && !this.tmuxWindow.isDestroyed()) {
      const rootNode = win?.rootNode
      if (rootNode) {
        this.tmuxWindow.webContents.send(TMUX_IPC.LAYOUT_CHANGE, windowId, rootNode)
      }
    }

    // Capture scrollback for any new panes from the layout change
    this.captureNewPanes(windowId)
  }

  private async captureNewPanes(windowId: string): Promise<void> {
    try {
      const paneLines = await this.queue.send(
        `list-panes -t ${windowId} -F "#{pane_id} #{pane_width} #{pane_height} #{pane_active}"`
      )
      for (const pl of paneLines) {
        const paneId = pl.split(' ')[0]
        if (!this.scrollbackDelivered.has(paneId)) {
          this.scrollbackDelivered.add(paneId)
          try {
            const scrollbackLines = await this.queue.send(
              `capture-pane -t ${paneId} -p -e -S -`
            )
            const scrollback = scrollbackLines.join('\r\n')
            if (scrollback.trim() && this.tmuxWindow && !this.tmuxWindow.isDestroyed()) {
              this.tmuxWindow.webContents.send(TMUX_IPC.SCROLLBACK, paneId, scrollback)
            }
          } catch {
            // Pane may have been closed already
          }
        }
      }
    } catch {
      // Window may have been closed
    }
  }

  private handleExit(reason?: string): void {
    logger.info({ sessionId: this.id, reason }, 'tmux session exited')

    // Notify both windows
    if (this.tmuxWindow && !this.tmuxWindow.isDestroyed()) {
      this.tmuxWindow.webContents.send(TMUX_IPC.EXIT)
    }
    if (!this.triggerWindow.isDestroyed()) {
      this.triggerWindow.webContents.send(TMUX_IPC.EXIT, this.triggerPtyId)
    }

    // Clean up — import done lazily to avoid circular dependency
    this.onExit?.()
  }

  /** Called by TmuxManager to register cleanup callback */
  onExit?: () => void
}
