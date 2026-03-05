import { Menu, app, BrowserWindow } from 'electron'
import { IPC } from '../shared/ipc-channels'
import { windowManager } from './window-manager'

export function buildMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'Shell',
      submenu: [
        {
          label: 'New Tab',
          accelerator: isMac ? 'Cmd+T' : 'Ctrl+Shift+T',
          click: (_, window) => {
            if (window) window.webContents.send('menu:new-tab')
          }
        },
        {
          id: 'new-window',
          label: 'New Window',
          accelerator: isMac ? 'Cmd+N' : 'Ctrl+Shift+N',
          click: () => {
            windowManager.createWindow()
          }
        },
        { type: 'separator' },
        {
          label: 'SFTP Browser',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            windowManager.createSftpWindow()
          }
        },
        {
          id: 'port-forwarding',
          label: 'Port Forwarding',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => {
            windowManager.createTunnelWindow()
          }
        },
        { type: 'separator' },
        {
          id: 'split-vertical',
          label: 'Split Vertically',
          accelerator: isMac ? 'Cmd+D' : 'Ctrl+Shift+E',
          click: (_, window) => {
            if (window) window.webContents.send('menu:split-vertical')
          }
        },
        {
          label: 'Split Horizontally',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: (_, window) => {
            if (window) window.webContents.send('menu:split-horizontal')
          }
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: isMac ? 'Cmd+W' : 'Ctrl+Shift+W',
          click: (_, window) => {
            if (window) window.webContents.send('menu:close-tab')
          }
        },
        { type: 'separator' },
        {
          label: 'Select Next Tab',
          accelerator: isMac ? 'Ctrl+Tab' : 'Ctrl+PageDown',
          click: (_, window) => {
            if (window) window.webContents.send('menu:next-tab')
          }
        },
        {
          label: 'Select Previous Tab',
          accelerator: isMac ? 'Ctrl+Shift+Tab' : 'Ctrl+PageUp',
          click: (_, window) => {
            if (window) window.webContents.send('menu:prev-tab')
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(!isMac
          ? [
              { type: 'separator' as const },
              {
                label: 'Toggle Menu Bar',
                accelerator: 'Ctrl+Shift+M',
                click: (_, window) => {
                  if (window) windowManager.toggleMenuBar(window)
                }
              }
            ]
          : [])
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ role: 'close' as const }])
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
