import { ipcMain, BrowserWindow } from 'electron'
import { SFTP_IPC } from '@shared/sftp-ipc-channels'
import type { ConnectionConfig, TransferRequest } from '@shared/sftp-types'
import { parseSshConfig } from './ssh-config-parser'
import {
  localList,
  localRename,
  localCopy,
  localDelete,
  localMkdir,
  localExists,
  localHome,
  localOpenFile
} from './local-file-service'
import { sftpConnectionManager } from './sftp-connection-manager'
import { startTransfer, cancelTransfer } from './rsync-transfer-service'
import { windowManager } from '../window-manager'
import logger from '../logger'

function getWindowId(event: Electron.IpcMainInvokeEvent): number {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) throw new Error('No window for event')
  return win.id
}

export function registerSftpIpcHandlers(): void {
  // SSH config
  ipcMain.handle(SFTP_IPC.PARSE_SSH_CONFIG, async () => {
    return parseSshConfig()
  })

  // Connection
  ipcMain.handle(SFTP_IPC.CONNECT, async (event, config: ConnectionConfig) => {
    const windowId = getWindowId(event)
    return sftpConnectionManager.connect(windowId, config)
  })

  ipcMain.handle(SFTP_IPC.DISCONNECT, async (event) => {
    const windowId = getWindowId(event)
    await sftpConnectionManager.disconnect(windowId)
  })

  // Remote file operations
  ipcMain.handle(SFTP_IPC.REMOTE_LIST, async (event, path: string) => {
    const windowId = getWindowId(event)
    return sftpConnectionManager.list(windowId, path)
  })

  ipcMain.handle(SFTP_IPC.REMOTE_RENAME, async (event, oldPath: string, newPath: string) => {
    const windowId = getWindowId(event)
    return sftpConnectionManager.remoteRename(windowId, oldPath, newPath)
  })

  ipcMain.handle(SFTP_IPC.REMOTE_DELETE, async (event, path: string, isDir: boolean) => {
    const windowId = getWindowId(event)
    return sftpConnectionManager.remoteDelete(windowId, path, isDir)
  })

  ipcMain.handle(SFTP_IPC.REMOTE_MKDIR, async (event, path: string) => {
    const windowId = getWindowId(event)
    return sftpConnectionManager.remoteMkdir(windowId, path)
  })

  ipcMain.handle(SFTP_IPC.REMOTE_EXISTS, async (event, path: string) => {
    const windowId = getWindowId(event)
    return sftpConnectionManager.remoteExists(windowId, path)
  })

  ipcMain.handle(SFTP_IPC.REMOTE_HOME, async (event) => {
    const windowId = getWindowId(event)
    return sftpConnectionManager.remoteHome(windowId)
  })

  // Local file operations
  ipcMain.handle(SFTP_IPC.LOCAL_LIST, async (_event, path: string) => {
    return localList(path)
  })

  ipcMain.handle(SFTP_IPC.LOCAL_RENAME, async (_event, oldPath: string, newPath: string) => {
    return localRename(oldPath, newPath)
  })

  ipcMain.handle(SFTP_IPC.LOCAL_COPY, async (_event, src: string, dest: string) => {
    return localCopy(src, dest)
  })

  ipcMain.handle(SFTP_IPC.LOCAL_DELETE, async (_event, path: string, isDir: boolean) => {
    return localDelete(path, isDir)
  })

  ipcMain.handle(SFTP_IPC.LOCAL_MKDIR, async (_event, path: string) => {
    return localMkdir(path)
  })

  ipcMain.handle(SFTP_IPC.LOCAL_EXISTS, async (_event, path: string) => {
    return localExists(path)
  })

  ipcMain.handle(SFTP_IPC.LOCAL_HOME, async () => {
    return localHome()
  })

  ipcMain.handle(SFTP_IPC.LOCAL_OPEN_FILE, async (_event, path: string) => {
    return localOpenFile(path)
  })

  // Transfers
  ipcMain.handle(SFTP_IPC.TRANSFER_START, async (event, request: TransferRequest) => {
    const windowId = getWindowId(event)
    startTransfer(windowId, request).catch((err) => {
      logger.error({ err, transferId: request.transferId }, 'Transfer failed')
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win && !win.isDestroyed()) {
        win.webContents.send(
          SFTP_IPC.TRANSFER_ERROR,
          request.transferId,
          err instanceof Error ? err.message : String(err)
        )
      }
    })
  })

  ipcMain.on(SFTP_IPC.TRANSFER_CANCEL, (_event, transferId: string) => {
    cancelTransfer(transferId)
  })

  // Window
  ipcMain.on(SFTP_IPC.WINDOW_NEW, () => {
    windowManager.createSftpWindow()
  })
}
