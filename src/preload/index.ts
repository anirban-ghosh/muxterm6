import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import { TMUX_IPC } from '../shared/tmux-ipc-channels'
import type { TerminalAPI } from './api'
import type { TmuxSessionInfo, TmuxWindowInfo } from '../shared/tmux-types'
import type { SplitNode } from '../shared/types'

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

  onMenuNextTab: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('menu:next-tab', handler)
    return () => ipcRenderer.removeListener('menu:next-tab', handler)
  },

  onMenuPrevTab: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('menu:prev-tab', handler)
    return () => ipcRenderer.removeListener('menu:prev-tab', handler)
  },

  newWindow: () => ipcRenderer.send(IPC.WINDOW_NEW),

  // Tmux control mode API
  writeTmuxPane: (tmuxPaneId: string, data: string) =>
    ipcRenderer.send(TMUX_IPC.INPUT, tmuxPaneId, data),

  resizeTmux: (cols: number, rows: number) =>
    ipcRenderer.send(TMUX_IPC.RESIZE, cols, rows),

  tmuxPaneResized: (tmuxPaneId: string, cols: number, rows: number) =>
    ipcRenderer.send(TMUX_IPC.PANE_RESIZED, tmuxPaneId, cols, rows),

  tmuxNewWindow: () =>
    ipcRenderer.send(TMUX_IPC.NEW_WINDOW),

  tmuxSplitPane: (tmuxPaneId: string, direction: 'horizontal' | 'vertical') =>
    ipcRenderer.send(TMUX_IPC.SPLIT_PANE, tmuxPaneId, direction),

  tmuxKillPane: (tmuxPaneId: string) =>
    ipcRenderer.send(TMUX_IPC.KILL_PANE, tmuxPaneId),

  tmuxResizePane: (tmuxPaneId: string, direction: 'x' | 'y', amount: number) =>
    ipcRenderer.send(TMUX_IPC.RESIZE_PANE, tmuxPaneId, direction, amount),

  tmuxDetach: (ptyId: string) =>
    ipcRenderer.send(TMUX_IPC.DETACH, ptyId),

  tmuxForceQuit: (ptyId: string) =>
    ipcRenderer.send(TMUX_IPC.FORCE_QUIT, ptyId),

  onTmuxDetected: (callback: (ptyId: string, sessionName: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ptyId: string, sessionName: string) =>
      callback(ptyId, sessionName)
    ipcRenderer.on(TMUX_IPC.DETECTED, handler)
    return () => ipcRenderer.removeListener(TMUX_IPC.DETECTED, handler)
  },

  onTmuxSessionReady: (callback: (info: TmuxSessionInfo) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: TmuxSessionInfo) =>
      callback(info)
    ipcRenderer.on(TMUX_IPC.SESSION_READY, handler)
    return () => ipcRenderer.removeListener(TMUX_IPC.SESSION_READY, handler)
  },

  onTmuxOutput: (callback: (tmuxPaneId: string, data: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, tmuxPaneId: string, data: string) =>
      callback(tmuxPaneId, data)
    ipcRenderer.on(TMUX_IPC.OUTPUT, handler)
    return () => ipcRenderer.removeListener(TMUX_IPC.OUTPUT, handler)
  },

  onTmuxScrollback: (callback: (tmuxPaneId: string, data: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, tmuxPaneId: string, data: string) =>
      callback(tmuxPaneId, data)
    ipcRenderer.on(TMUX_IPC.SCROLLBACK, handler)
    return () => ipcRenderer.removeListener(TMUX_IPC.SCROLLBACK, handler)
  },

  onTmuxTabAdd: (callback: (info: TmuxWindowInfo) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: TmuxWindowInfo) =>
      callback(info)
    ipcRenderer.on(TMUX_IPC.TAB_ADD, handler)
    return () => ipcRenderer.removeListener(TMUX_IPC.TAB_ADD, handler)
  },

  onTmuxTabClose: (callback: (windowId: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, windowId: string) =>
      callback(windowId)
    ipcRenderer.on(TMUX_IPC.TAB_CLOSE, handler)
    return () => ipcRenderer.removeListener(TMUX_IPC.TAB_CLOSE, handler)
  },

  onTmuxTabRenamed: (callback: (windowId: string, name: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, windowId: string, name: string) =>
      callback(windowId, name)
    ipcRenderer.on(TMUX_IPC.TAB_RENAMED, handler)
    return () => ipcRenderer.removeListener(TMUX_IPC.TAB_RENAMED, handler)
  },

  onTmuxLayoutChange: (callback: (windowId: string, rootNode: SplitNode) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, windowId: string, rootNode: SplitNode) =>
      callback(windowId, rootNode)
    ipcRenderer.on(TMUX_IPC.LAYOUT_CHANGE, handler)
    return () => ipcRenderer.removeListener(TMUX_IPC.LAYOUT_CHANGE, handler)
  },

  onTmuxExit: (callback: (ptyId?: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ptyId?: string) =>
      callback(ptyId)
    ipcRenderer.on(TMUX_IPC.EXIT, handler)
    return () => ipcRenderer.removeListener(TMUX_IPC.EXIT, handler)
  }
}

contextBridge.exposeInMainWorld('terminalAPI', api)
