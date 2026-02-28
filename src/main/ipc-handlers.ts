import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../shared/ipc-channels'
import { TMUX_IPC } from '../shared/tmux-ipc-channels'
import { ptyManager } from './pty-manager'
import { windowManager } from './window-manager'
import { tmuxManager } from './tmux/tmux-manager'
import logger from './logger'

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.PTY_CREATE, (event, cols?: number, rows?: number) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      logger.error('pty:create called without a valid window')
      throw new Error('No window')
    }
    return ptyManager.create(window, cols, rows)
  })

  ipcMain.handle(IPC.PTY_DESTROY, (_event, ptyId: string) => {
    ptyManager.destroy(ptyId)
  })

  ipcMain.handle(IPC.PTY_RESIZE, (_event, ptyId: string, cols: number, rows: number) => {
    ptyManager.resize(ptyId, cols, rows)
  })

  ipcMain.on(IPC.PTY_INPUT, (_event, ptyId: string, data: string) => {
    ptyManager.write(ptyId, data)
  })

  ipcMain.on(IPC.WINDOW_NEW, () => {
    windowManager.createWindow()
  })

  // Tmux IPC handlers
  ipcMain.on(TMUX_IPC.INPUT, (event, tmuxPaneId: string, data: string) => {
    const session = getSessionForSender(event.sender)
    if (session) {
      session.sendKeys(tmuxPaneId, data)
    }
  })

  ipcMain.on(TMUX_IPC.RESIZE, (event, cols: number, rows: number) => {
    const session = getSessionForSender(event.sender)
    if (session) {
      session.refreshClient(cols, rows)
    }
  })

  ipcMain.on(TMUX_IPC.PANE_RESIZED, (event, tmuxPaneId: string, cols: number, rows: number) => {
    const session = getSessionForSender(event.sender)
    if (session) {
      session.paneResized(tmuxPaneId, cols, rows)
    }
  })

  ipcMain.on(TMUX_IPC.NEW_WINDOW, (event) => {
    const session = getSessionForSender(event.sender)
    if (session) {
      session.newWindow()
    }
  })

  ipcMain.on(
    TMUX_IPC.SPLIT_PANE,
    (event, tmuxPaneId: string, direction: 'horizontal' | 'vertical') => {
      const session = getSessionForSender(event.sender)
      if (session) {
        session.splitPaneCmd(tmuxPaneId, direction)
      }
    }
  )

  ipcMain.on(TMUX_IPC.KILL_PANE, (event, tmuxPaneId: string) => {
    const session = getSessionForSender(event.sender)
    if (session) {
      session.killPane(tmuxPaneId)
    }
  })

  ipcMain.on(
    TMUX_IPC.RESIZE_PANE,
    (event, tmuxPaneId: string, direction: 'x' | 'y', amount: number) => {
      const session = getSessionForSender(event.sender)
      if (session) {
        session.resizePane(tmuxPaneId, direction, amount)
      }
    }
  )

  ipcMain.on(TMUX_IPC.DETACH, (_event, ptyId: string) => {
    const session = tmuxManager.getSession(ptyId)
    if (session) {
      session.detach()
    }
  })

  ipcMain.on(TMUX_IPC.FORCE_QUIT, (_event, ptyId: string) => {
    const session = tmuxManager.getSession(ptyId)
    if (session) {
      session.forceQuit()
      tmuxManager.removeSession(ptyId)
    }
  })
}

function getSessionForSender(sender: Electron.WebContents) {
  const senderUrl = sender.getURL()
  const match = senderUrl.match(/[?&]tmux=([^&]+)/)
  if (match) {
    const sessionId = decodeURIComponent(match[1])
    return tmuxManager.getSessionById(sessionId)
  }
  return undefined
}

