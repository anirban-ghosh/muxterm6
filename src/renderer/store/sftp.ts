import { create } from 'zustand'
import type {
  FileEntry,
  ConnectionConfig,
  TransferProgress,
  HostKeyInfo
} from '@shared/sftp-types'

interface SftpState {
  // Connection
  connected: boolean
  connecting: boolean
  connectionError: string | null
  connectionConfig: ConnectionConfig | null

  // Local pane
  localPath: string
  localFiles: FileEntry[]
  localLoading: boolean
  localSelection: Set<string>

  // Remote pane
  remotePath: string
  remoteFiles: FileEntry[]
  remoteLoading: boolean
  remoteSelection: Set<string>

  // Clipboard
  clipboard: {
    files: FileEntry[]
    operation: 'copy' | 'cut'
    source: 'local' | 'remote'
  } | null

  // Transfers
  transfers: Map<string, TransferProgress>

  // Dialogs
  showConnectionDialog: boolean
  hostKeyInfo: HostKeyInfo | null
  showPasswordDialog: boolean
  conflictInfo: {
    filename: string
    resolve: (action: 'cancel' | 'overwrite' | 'rename') => void
  } | null

  // Actions
  setConnected: (connected: boolean) => void
  setConnecting: (connecting: boolean) => void
  setConnectionError: (error: string | null) => void
  setConnectionConfig: (config: ConnectionConfig | null) => void

  setLocalPath: (path: string) => void
  setLocalFiles: (files: FileEntry[]) => void
  setLocalLoading: (loading: boolean) => void
  setLocalSelection: (selection: Set<string>) => void

  setRemotePath: (path: string) => void
  setRemoteFiles: (files: FileEntry[]) => void
  setRemoteLoading: (loading: boolean) => void
  setRemoteSelection: (selection: Set<string>) => void

  setClipboard: (clipboard: SftpState['clipboard']) => void

  updateTransfer: (progress: TransferProgress) => void
  removeTransfer: (transferId: string) => void

  setShowConnectionDialog: (show: boolean) => void
  setHostKeyInfo: (info: HostKeyInfo | null) => void
  setShowPasswordDialog: (show: boolean) => void
  setConflictInfo: (info: SftpState['conflictInfo']) => void

  reset: () => void
}

const initialState = {
  connected: false,
  connecting: false,
  connectionError: null,
  connectionConfig: null,
  localPath: '',
  localFiles: [],
  localLoading: false,
  localSelection: new Set<string>(),
  remotePath: '',
  remoteFiles: [],
  remoteLoading: false,
  remoteSelection: new Set<string>(),
  clipboard: null,
  transfers: new Map<string, TransferProgress>(),
  showConnectionDialog: false,
  hostKeyInfo: null,
  showPasswordDialog: false,
  conflictInfo: null
}

export const useSftpStore = create<SftpState>()((set) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),
  setConnecting: (connecting) => set({ connecting }),
  setConnectionError: (connectionError) => set({ connectionError }),
  setConnectionConfig: (connectionConfig) => set({ connectionConfig }),

  setLocalPath: (localPath) => set({ localPath }),
  setLocalFiles: (localFiles) => set({ localFiles }),
  setLocalLoading: (localLoading) => set({ localLoading }),
  setLocalSelection: (localSelection) => set({ localSelection }),

  setRemotePath: (remotePath) => set({ remotePath }),
  setRemoteFiles: (remoteFiles) => set({ remoteFiles }),
  setRemoteLoading: (remoteLoading) => set({ remoteLoading }),
  setRemoteSelection: (remoteSelection) => set({ remoteSelection }),

  setClipboard: (clipboard) => set({ clipboard }),

  updateTransfer: (progress) =>
    set((state) => {
      const transfers = new Map(state.transfers)
      transfers.set(progress.transferId, progress)
      return { transfers }
    }),

  removeTransfer: (transferId) =>
    set((state) => {
      const transfers = new Map(state.transfers)
      transfers.delete(transferId)
      return { transfers }
    }),

  setShowConnectionDialog: (showConnectionDialog) => set({ showConnectionDialog }),
  setHostKeyInfo: (hostKeyInfo) => set({ hostKeyInfo }),
  setShowPasswordDialog: (showPasswordDialog) => set({ showPasswordDialog }),
  setConflictInfo: (conflictInfo) => set({ conflictInfo }),

  reset: () => set(initialState)
}))
