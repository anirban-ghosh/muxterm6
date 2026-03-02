import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import { TMUX_IPC } from '../shared/tmux-ipc-channels'
import { SFTP_IPC } from '../shared/sftp-ipc-channels'
import { TUNNEL_IPC } from '../shared/tunnel-ipc-channels'
import type { TerminalAPI } from './api'
import type { SftpAPI } from './sftp-api'
import type { TunnelAPI } from './tunnel-api'
import type { TmuxSessionInfo, TmuxWindowInfo } from '../shared/tmux-types'
import type { SplitNode } from '../shared/types'
import type { TransferProgress, HostKeyInfo } from '../shared/sftp-types'
import type { TunnelInfo } from '../shared/tunnel-types'

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

const sftpApi: SftpAPI = {
  parseSshConfig: () => ipcRenderer.invoke(SFTP_IPC.PARSE_SSH_CONFIG),
  connect: (config) => ipcRenderer.invoke(SFTP_IPC.CONNECT, config),
  disconnect: () => ipcRenderer.invoke(SFTP_IPC.DISCONNECT),

  remoteList: (path) => ipcRenderer.invoke(SFTP_IPC.REMOTE_LIST, path),
  remoteRename: (oldPath, newPath) => ipcRenderer.invoke(SFTP_IPC.REMOTE_RENAME, oldPath, newPath),
  remoteDelete: (path, isDir) => ipcRenderer.invoke(SFTP_IPC.REMOTE_DELETE, path, isDir),
  remoteMkdir: (path) => ipcRenderer.invoke(SFTP_IPC.REMOTE_MKDIR, path),
  remoteExists: (path) => ipcRenderer.invoke(SFTP_IPC.REMOTE_EXISTS, path),
  remoteHome: () => ipcRenderer.invoke(SFTP_IPC.REMOTE_HOME),

  localList: (path) => ipcRenderer.invoke(SFTP_IPC.LOCAL_LIST, path),
  localRename: (oldPath, newPath) => ipcRenderer.invoke(SFTP_IPC.LOCAL_RENAME, oldPath, newPath),
  localCopy: (src, dest) => ipcRenderer.invoke(SFTP_IPC.LOCAL_COPY, src, dest),
  localDelete: (path, isDir) => ipcRenderer.invoke(SFTP_IPC.LOCAL_DELETE, path, isDir),
  localMkdir: (path) => ipcRenderer.invoke(SFTP_IPC.LOCAL_MKDIR, path),
  localExists: (path) => ipcRenderer.invoke(SFTP_IPC.LOCAL_EXISTS, path),
  localHome: () => ipcRenderer.invoke(SFTP_IPC.LOCAL_HOME),
  localOpenFile: (path) => ipcRenderer.invoke(SFTP_IPC.LOCAL_OPEN_FILE, path),

  transferStart: (request) => ipcRenderer.invoke(SFTP_IPC.TRANSFER_START, request),
  transferCancel: (transferId) => ipcRenderer.send(SFTP_IPC.TRANSFER_CANCEL, transferId),

  onTransferProgress: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, progress: TransferProgress) =>
      callback(progress)
    ipcRenderer.on(SFTP_IPC.TRANSFER_PROGRESS, handler)
    return () => ipcRenderer.removeListener(SFTP_IPC.TRANSFER_PROGRESS, handler)
  },
  onTransferComplete: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, transferId: string) => callback(transferId)
    ipcRenderer.on(SFTP_IPC.TRANSFER_COMPLETE, handler)
    return () => ipcRenderer.removeListener(SFTP_IPC.TRANSFER_COMPLETE, handler)
  },
  onTransferError: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, transferId: string, error: string) =>
      callback(transferId, error)
    ipcRenderer.on(SFTP_IPC.TRANSFER_ERROR, handler)
    return () => ipcRenderer.removeListener(SFTP_IPC.TRANSFER_ERROR, handler)
  },

  onHostKeyVerify: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, info: HostKeyInfo) => callback(info)
    ipcRenderer.on(SFTP_IPC.HOST_KEY_VERIFY, handler)
    return () => ipcRenderer.removeListener(SFTP_IPC.HOST_KEY_VERIFY, handler)
  },
  respondHostKey: (accepted) => ipcRenderer.send(SFTP_IPC.HOST_KEY_RESPONSE, accepted),

  onPasswordPrompt: (callback) => {
    const handler = () => callback()
    ipcRenderer.on(SFTP_IPC.PASSWORD_PROMPT, handler)
    return () => ipcRenderer.removeListener(SFTP_IPC.PASSWORD_PROMPT, handler)
  },
  respondPassword: (password) => ipcRenderer.send(SFTP_IPC.PASSWORD_RESPONSE, password),

  newSftpWindow: () => ipcRenderer.send(SFTP_IPC.WINDOW_NEW)
}

contextBridge.exposeInMainWorld('sftpAPI', sftpApi)

const tunnelApi: TunnelAPI = {
  parseSshConfig: () => ipcRenderer.invoke(TUNNEL_IPC.PARSE_SSH_CONFIG),
  createTunnel: (config) => ipcRenderer.invoke(TUNNEL_IPC.CREATE, config),
  destroyTunnel: (id) => ipcRenderer.invoke(TUNNEL_IPC.DESTROY, id),
  pauseTunnel: (id) => ipcRenderer.invoke(TUNNEL_IPC.PAUSE, id),
  resumeTunnel: (id) => ipcRenderer.invoke(TUNNEL_IPC.RESUME, id),
  listTunnels: () => ipcRenderer.invoke(TUNNEL_IPC.LIST),

  onStatusUpdate: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, info: TunnelInfo) => callback(info)
    ipcRenderer.on(TUNNEL_IPC.STATUS_UPDATE, handler)
    return () => ipcRenderer.removeListener(TUNNEL_IPC.STATUS_UPDATE, handler)
  },

  onHostKeyVerify: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, info: HostKeyInfo) => callback(info)
    ipcRenderer.on(TUNNEL_IPC.HOST_KEY_VERIFY, handler)
    return () => ipcRenderer.removeListener(TUNNEL_IPC.HOST_KEY_VERIFY, handler)
  },
  respondHostKey: (accepted) => ipcRenderer.send(TUNNEL_IPC.HOST_KEY_RESPONSE, accepted),

  onPasswordPrompt: (callback) => {
    const handler = () => callback()
    ipcRenderer.on(TUNNEL_IPC.PASSWORD_PROMPT, handler)
    return () => ipcRenderer.removeListener(TUNNEL_IPC.PASSWORD_PROMPT, handler)
  },
  respondPassword: (password) => ipcRenderer.send(TUNNEL_IPC.PASSWORD_RESPONSE, password),

  newTunnelWindow: () => ipcRenderer.send(TUNNEL_IPC.WINDOW_NEW)
}

contextBridge.exposeInMainWorld('tunnelAPI', tunnelApi)
