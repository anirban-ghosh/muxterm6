import type {
  FileEntry,
  SshHostConfig,
  ConnectionConfig,
  TransferRequest,
  TransferProgress,
  HostKeyInfo
} from '../shared/sftp-types'

export interface SftpAPI {
  parseSshConfig(): Promise<SshHostConfig[]>
  connect(config: ConnectionConfig): Promise<string>
  disconnect(): Promise<void>

  remoteList(path: string): Promise<FileEntry[]>
  remoteRename(oldPath: string, newPath: string): Promise<void>
  remoteDelete(path: string, isDir: boolean): Promise<void>
  remoteMkdir(path: string): Promise<void>
  remoteExists(path: string): Promise<false | 'd' | '-'>
  remoteHome(): Promise<string>

  localList(path: string): Promise<FileEntry[]>
  localRename(oldPath: string, newPath: string): Promise<void>
  localCopy(src: string, dest: string): Promise<void>
  localDelete(path: string, isDir: boolean): Promise<void>
  localMkdir(path: string): Promise<void>
  localExists(path: string): Promise<false | 'd' | '-'>
  localHome(): Promise<string>
  localOpenFile(path: string): Promise<void>

  transferStart(request: TransferRequest): Promise<void>
  transferCancel(transferId: string): void

  onTransferProgress(callback: (progress: TransferProgress) => void): () => void
  onTransferComplete(callback: (transferId: string) => void): () => void
  onTransferError(callback: (transferId: string, error: string) => void): () => void

  onHostKeyVerify(callback: (info: HostKeyInfo) => void): () => void
  respondHostKey(accepted: boolean): void

  onPasswordPrompt(callback: () => void): () => void
  respondPassword(password: string): void

  newSftpWindow(): void
}

declare global {
  interface Window {
    sftpAPI: SftpAPI
  }
}
