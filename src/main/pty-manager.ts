import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import { resolveShell, getShellArgs } from './shell-resolver'
import { IPC } from '../shared/ipc-channels'
import { DEFAULT_COLS, DEFAULT_ROWS } from '../shared/constants'
import type { PtyCreateResult } from '../shared/types'
import logger from './logger'

interface PtyInstance {
  process: pty.IPty
  windowId: number
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
      if (!window.isDestroyed()) {
        window.webContents.send(IPC.PTY_OUTPUT, id, data)
      }
    })

    proc.onExit(({ exitCode }) => {
      logger.info({ ptyId: id, exitCode }, 'pty exited')
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
