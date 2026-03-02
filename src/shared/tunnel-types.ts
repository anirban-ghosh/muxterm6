export type TunnelType = 'local' | 'remote' | 'dynamic'
export type TunnelStatus = 'connecting' | 'active' | 'paused' | 'error'

export interface TunnelConfig {
  type: TunnelType
  // SSH connection
  hostname: string
  port: number
  username: string
  identityFile?: string
  // Tunnel parameters
  localPort: number
  remoteHost: string // only for local/remote
  remotePort: number // only for local/remote
}

export interface TunnelInfo {
  id: string
  config: TunnelConfig
  status: TunnelStatus
  error?: string
  activeConnections: number
}
