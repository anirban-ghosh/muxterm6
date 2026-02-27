import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../shared/ipc-channels'
import { ptyManager } from './pty-manager'
import { windowManager } from './window-manager'
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
}
