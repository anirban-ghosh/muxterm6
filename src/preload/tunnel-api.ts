import type { TunnelConfig, TunnelInfo } from '../shared/tunnel-types'
import type { SshHostConfig, HostKeyInfo } from '../shared/sftp-types'

export interface TunnelAPI {
  parseSshConfig(): Promise<SshHostConfig[]>
  createTunnel(config: TunnelConfig): Promise<TunnelInfo>
  destroyTunnel(id: string): Promise<void>
  pauseTunnel(id: string): Promise<void>
  resumeTunnel(id: string): Promise<void>
  listTunnels(): Promise<TunnelInfo[]>

  onStatusUpdate(callback: (info: TunnelInfo) => void): () => void

  onHostKeyVerify(callback: (info: HostKeyInfo) => void): () => void
  respondHostKey(accepted: boolean): void

  onPasswordPrompt(callback: () => void): () => void
  respondPassword(password: string): void

  newTunnelWindow(): void
}

declare global {
  interface Window {
    tunnelAPI: TunnelAPI
  }
}
