import { ipcMain, BrowserWindow } from 'electron'
import { TUNNEL_IPC } from '@shared/tunnel-ipc-channels'
import type { TunnelConfig } from '@shared/tunnel-types'
import { parseSshConfig } from '../sftp/ssh-config-parser'
import { tunnelManager } from './tunnel-manager'
import { windowManager } from '../window-manager'
import logger from '../logger'

function getWindowId(event: Electron.IpcMainInvokeEvent): number {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) throw new Error('No window for event')
  return win.id
}

export function registerTunnelIpcHandlers(): void {
  ipcMain.handle(TUNNEL_IPC.PARSE_SSH_CONFIG, async () => {
    return parseSshConfig()
  })

  ipcMain.handle(TUNNEL_IPC.CREATE, async (event, config: TunnelConfig) => {
    const windowId = getWindowId(event)
    return tunnelManager.createTunnel(config, windowId)
  })

  ipcMain.handle(TUNNEL_IPC.DESTROY, async (_event, id: string) => {
    await tunnelManager.destroyTunnel(id)
  })

  ipcMain.handle(TUNNEL_IPC.PAUSE, async (_event, id: string) => {
    await tunnelManager.pauseTunnel(id)
  })

  ipcMain.handle(TUNNEL_IPC.RESUME, async (_event, id: string) => {
    await tunnelManager.resumeTunnel(id)
  })

  ipcMain.handle(TUNNEL_IPC.LIST, async (event) => {
    const windowId = getWindowId(event)
    tunnelManager.setManagerWindow(windowId)
    return tunnelManager.listTunnels()
  })

  ipcMain.on(TUNNEL_IPC.WINDOW_NEW, () => {
    windowManager.createTunnelWindow()
  })
}
