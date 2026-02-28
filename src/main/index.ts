import { app, BrowserWindow } from 'electron'
import { windowManager } from './window-manager'
import { registerIpcHandlers } from './ipc-handlers'
import { registerSftpIpcHandlers } from './sftp/sftp-ipc-handlers'
import { buildMenu } from './menu'
import logger from './logger'

app.whenReady().then(() => {
  registerIpcHandlers()
  registerSftpIpcHandlers()
  buildMenu()
  windowManager.createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createWindow()
    }
  })

  logger.info('MuxTerm started')
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
