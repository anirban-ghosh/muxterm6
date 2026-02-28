import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import { resolveShell, getShellArgs } from './shell-resolver'
import { IPC } from '../shared/ipc-channels'
import { DEFAULT_COLS, DEFAULT_ROWS } from '../shared/constants'
import type { PtyCreateResult } from '../shared/types'
import { tmuxManager } from './tmux/tmux-manager'
import logger from './logger'

const DCS_SEQUENCE = '\x1bP1000p'
const DCS_DETECT_BUFFER_SIZE = 8

interface PtyInstance {
  process: pty.IPty
  windowId: number
  dcsBuffer?: string
  tmuxMode?: boolean
}

class PtyManager {
  private ptys = new Map<string, PtyInstance>()
  private nextId = 0

  create(window: BrowserWindow, cols?: number, rows?: number): PtyCreateResult {
    const shell = resolveShell()
    const args = getShellArgs(shell)
    const id = `pty-${++this.nextId}`

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor'
    }

    const proc = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: cols || DEFAULT_COLS,
      rows: rows || DEFAULT_ROWS,
      cwd: process.env.HOME || '/',
      env
    })

    this.ptys.set(id, { process: proc, windowId: window.id })

    proc.onData((data) => {
      const instance = this.ptys.get(id)
      if (!instance) return

      // If already in tmux mode, route all data to the session
      if (instance.tmuxMode) {
        const session = tmuxManager.getSession(id)
        if (session) {
          const remaining = session.feedData(data)
          if (remaining) {
            // %exit encountered — session ended, remaining is raw shell output
            instance.tmuxMode = false
            instance.dcsBuffer = undefined
            if (!window.isDestroyed()) {
              window.webContents.send(IPC.PTY_OUTPUT, id, remaining)
            }
          }
        }
        return
      }

      // Buffer up to DCS_DETECT_BUFFER_SIZE bytes to detect DCS sequence
      if (instance.dcsBuffer !== undefined) {
        instance.dcsBuffer += data
        const buf = instance.dcsBuffer

        if (buf.includes(DCS_SEQUENCE)) {
          // Found DCS sequence — enter tmux mode
          const dcsIdx = buf.indexOf(DCS_SEQUENCE)

          // Send any data before the DCS as normal output
          if (dcsIdx > 0 && !window.isDestroyed()) {
            window.webContents.send(IPC.PTY_OUTPUT, id, buf.substring(0, dcsIdx))
          }

          instance.tmuxMode = true
          instance.dcsBuffer = undefined
          tmuxManager.startSession(id, window)

          // Feed any data after the DCS to the session
          const afterDcs = buf.substring(dcsIdx + DCS_SEQUENCE.length)
          if (afterDcs.length > 0) {
            const session = tmuxManager.getSession(id)
            if (session) session.feedData(afterDcs)
          }
          return
        }

        if (buf.length >= DCS_DETECT_BUFFER_SIZE) {
          // No DCS found in buffer — flush as normal output and stop buffering
          instance.dcsBuffer = undefined
          if (!window.isDestroyed()) {
            window.webContents.send(IPC.PTY_OUTPUT, id, buf)
          }
        }
        return
      }

      // Check if this chunk might start a DCS sequence
      if (data.includes('\x1b') || data.includes(DCS_SEQUENCE)) {
        if (data.includes(DCS_SEQUENCE)) {
          const dcsIdx = data.indexOf(DCS_SEQUENCE)
          if (dcsIdx > 0 && !window.isDestroyed()) {
            window.webContents.send(IPC.PTY_OUTPUT, id, data.substring(0, dcsIdx))
          }
          instance.tmuxMode = true
          tmuxManager.startSession(id, window)
          const afterDcs = data.substring(dcsIdx + DCS_SEQUENCE.length)
          if (afterDcs.length > 0) {
            const session = tmuxManager.getSession(id)
            if (session) session.feedData(afterDcs)
          }
          return
        }

        // Might be a partial DCS — start buffering
        if (data.endsWith('\x1b') || data.endsWith('\x1bP') ||
            data.endsWith('\x1bP1') || data.endsWith('\x1bP10') ||
            data.endsWith('\x1bP100') || data.endsWith('\x1bP1000')) {
          instance.dcsBuffer = data
          return
        }
      }

      if (!window.isDestroyed()) {
        window.webContents.send(IPC.PTY_OUTPUT, id, data)
      }
    })

    proc.onExit(({ exitCode }) => {
      logger.info({ ptyId: id, exitCode }, 'pty exited')
      if (tmuxManager.hasSession(id)) {
        tmuxManager.removeSession(id)
      }
      if (!window.isDestroyed()) {
        window.webContents.send(IPC.PTY_EXIT, id, exitCode)
      }
      this.ptys.delete(id)
    })

    logger.info({ ptyId: id, shell, pid: proc.pid }, 'pty created')

    return { ptyId: id, pid: proc.pid, shell }
  }

  write(ptyId: string, data: string): void {
    const instance = this.ptys.get(ptyId)
    if (instance) {
      instance.process.write(data)
    }
  }

  resize(ptyId: string, cols: number, rows: number): void {
    const instance = this.ptys.get(ptyId)
    if (instance) {
      try {
        instance.process.resize(cols, rows)
      } catch (e) {
        logger.warn({ ptyId, cols, rows, error: e }, 'pty resize failed')
      }
    }
  }

  clearTmuxMode(ptyId: string): void {
    const instance = this.ptys.get(ptyId)
    if (instance) {
      instance.tmuxMode = false
      instance.dcsBuffer = undefined
      logger.info({ ptyId }, 'pty tmux mode cleared')
    }
  }

  destroy(ptyId: string): void {
    const instance = this.ptys.get(ptyId)
    if (instance) {
      instance.process.kill()
      this.ptys.delete(ptyId)
      logger.info({ ptyId }, 'pty destroyed')
    }
  }

  destroyAllForWindow(windowId: number): void {
    for (const [id, instance] of this.ptys) {
      if (instance.windowId === windowId) {
        instance.process.kill()
        this.ptys.delete(id)
      }
    }
  }

  destroyAll(): void {
    for (const [id, instance] of this.ptys) {
      instance.process.kill()
      this.ptys.delete(id)
    }
  }
}

export const ptyManager = new PtyManager()
