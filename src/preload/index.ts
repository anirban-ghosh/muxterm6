import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { TerminalAPI } from './api'

const api: TerminalAPI = {
  createPty: (cols?: number, rows?: number) =>
    ipcRenderer.invoke(IPC.PTY_CREATE, cols, rows),

  destroyPty: (ptyId: string) =>
    ipcRenderer.invoke(IPC.PTY_DESTROY, ptyId),

  resizePty: (ptyId: string, cols: number, rows: number) =>
    ipcRenderer.invoke(IPC.PTY_RESIZE, ptyId, cols, rows),

  writePty: (ptyId: string, data: string) =>
    ipcRenderer.send(IPC.PTY_INPUT, ptyId, data),

  onPtyOutput: (callback: (ptyId: string, data: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ptyId: string, data: string) =>
      callback(ptyId, data)
    ipcRenderer.on(IPC.PTY_OUTPUT, handler)
    return () => ipcRenderer.removeListener(IPC.PTY_OUTPUT, handler)
  },

  onPtyExit: (callback: (ptyId: string, exitCode: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ptyId: string, exitCode: number) =>
      callback(ptyId, exitCode)
    ipcRenderer.on(IPC.PTY_EXIT, handler)
    return () => ipcRenderer.removeListener(IPC.PTY_EXIT, handler)
  },

  onPtyTitle: (callback: (ptyId: string, title: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ptyId: string, title: string) =>
      callback(ptyId, title)
    ipcRenderer.on(IPC.PTY_TITLE, handler)
    return () => ipcRenderer.removeListener(IPC.PTY_TITLE, handler)
  },

  onMenuNewTab: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('menu:new-tab', handler)
    return () => ipcRenderer.removeListener('menu:new-tab', handler)
  },

  onMenuCloseTab: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('menu:close-tab', handler)
    return () => ipcRenderer.removeListener('menu:close-tab', handler)
  },

  onMenuSplitVertical: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('menu:split-vertical', handler)
    return () => ipcRenderer.removeListener('menu:split-vertical', handler)
  },

  onMenuSplitHorizontal: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('menu:split-horizontal', handler)
    return () => ipcRenderer.removeListener('menu:split-horizontal', handler)
  },

  newWindow: () => ipcRenderer.send(IPC.WINDOW_NEW)
}

contextBridge.exposeInMainWorld('terminalAPI', api)
