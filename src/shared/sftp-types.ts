export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: number
  permissions: string
}

export interface SshHostConfig {
  host: string
  hostname: string
  port: number
  user: string
  identityFile?: string
}

export interface ConnectionConfig {
  hostname: string
  port: number
  username: string
  identityFile?: string
  remotePath?: string
}

export interface TransferRequest {
  transferId: string
  sourcePath: string
  destPath: string
  direction: 'upload' | 'download'
  isDirectory: boolean
}

export interface TransferProgress {
  transferId: string
  filename: string
  bytesTransferred: number
  totalBytes: number
  percentage: number
  speed: string
}

export interface ConflictResolution {
  action: 'cancel' | 'overwrite' | 'rename'
  newName?: string
}

export interface HostKeyInfo {
  hostname: string
  fingerprint: string
  type: string
}
