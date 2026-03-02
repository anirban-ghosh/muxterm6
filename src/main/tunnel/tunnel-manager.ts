import { Client } from 'ssh2'
import * as net from 'net'
import { readFile } from 'fs/promises'
import { BrowserWindow, ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { TUNNEL_IPC } from '@shared/tunnel-ipc-channels'
import type { TunnelConfig, TunnelInfo, TunnelStatus } from '@shared/tunnel-types'
import type { HostKeyInfo } from '@shared/sftp-types'
import logger from '../logger'

interface ManagedTunnel {
  id: string
  config: TunnelConfig
  status: TunnelStatus
  error?: string
  sshClient: Client
  server: net.Server | null
  activeConnections: number
}

class TunnelManager {
  private tunnels = new Map<string, ManagedTunnel>()
  private managerWindowId: number | null = null

  setManagerWindow(windowId: number | null): void {
    this.managerWindowId = windowId
  }

  async createTunnel(config: TunnelConfig, authWindowId: number): Promise<TunnelInfo> {
    const id = randomUUID()
    const tunnel: ManagedTunnel = {
      id,
      config,
      status: 'connecting',
      sshClient: new Client(),
      server: null,
      activeConnections: 0
    }

    this.tunnels.set(id, tunnel)
    this.notifyStatusUpdate(tunnel)

    try {
      await this.connectSSH(tunnel, authWindowId)
      await this.setupForwarding(tunnel)
      tunnel.status = 'active'
      this.notifyStatusUpdate(tunnel)
      logger.info({ tunnelId: id, type: config.type, host: config.hostname }, 'tunnel created')
    } catch (err) {
      tunnel.status = 'error'
      tunnel.error = err instanceof Error ? err.message : String(err)
      this.notifyStatusUpdate(tunnel)
      logger.error({ tunnelId: id, err }, 'tunnel creation failed')
      // Clean up on failure
      tunnel.sshClient.end()
      if (tunnel.server) tunnel.server.close()
      this.tunnels.delete(id)
      throw err
    }

    return this.toInfo(tunnel)
  }

  async destroyTunnel(id: string): Promise<void> {
    const tunnel = this.tunnels.get(id)
    if (!tunnel) return

    if (tunnel.server) {
      tunnel.server.close()
      tunnel.server = null
    }
    tunnel.sshClient.end()
    this.tunnels.delete(id)
    logger.info({ tunnelId: id }, 'tunnel destroyed')
  }

  async pauseTunnel(id: string): Promise<void> {
    const tunnel = this.tunnels.get(id)
    if (!tunnel || tunnel.status !== 'active') return

    if (tunnel.server) {
      tunnel.server.close()
      tunnel.server = null
    }

    if (tunnel.config.type === 'remote') {
      tunnel.sshClient.unforwardIn('0.0.0.0', tunnel.config.remotePort, () => {})
    }

    tunnel.status = 'paused'
    tunnel.activeConnections = 0
    this.notifyStatusUpdate(tunnel)
    logger.info({ tunnelId: id }, 'tunnel paused')
  }

  async resumeTunnel(id: string): Promise<void> {
    const tunnel = this.tunnels.get(id)
    if (!tunnel || tunnel.status !== 'paused') return

    try {
      await this.setupForwarding(tunnel)
      tunnel.status = 'active'
      this.notifyStatusUpdate(tunnel)
      logger.info({ tunnelId: id }, 'tunnel resumed')
    } catch (err) {
      tunnel.status = 'error'
      tunnel.error = err instanceof Error ? err.message : String(err)
      this.notifyStatusUpdate(tunnel)
    }
  }

  listTunnels(): TunnelInfo[] {
    return Array.from(this.tunnels.values()).map((t) => this.toInfo(t))
  }

  async destroyAll(): Promise<void> {
    const ids = Array.from(this.tunnels.keys())
    for (const id of ids) {
      await this.destroyTunnel(id)
    }
  }

  private async connectSSH(tunnel: ManagedTunnel, authWindowId: number): Promise<void> {
    const { config, sshClient } = tunnel
    const win = BrowserWindow.fromId(authWindowId)

    return new Promise<void>((resolve, reject) => {
      const connectConfig: Record<string, unknown> = {
        host: config.hostname,
        port: config.port,
        username: config.username,
        readyTimeout: 10000,
        keepaliveInterval: 30000
      }

      // Host key verification via IPC round-trip
      connectConfig.hostVerifier = (keyHash: string, callback: (accept: boolean) => void) => {
        if (!win || win.isDestroyed()) {
          callback(false)
          return
        }

        const info: HostKeyInfo = {
          hostname: config.hostname,
          fingerprint: keyHash,
          type: 'ssh-rsa'
        }

        const handler = (_event: Electron.IpcMainEvent, accepted: boolean) => {
          callback(accepted)
        }
        ipcMain.once(TUNNEL_IPC.HOST_KEY_RESPONSE, handler)
        win.webContents.send(TUNNEL_IPC.HOST_KEY_VERIFY, info)
      }

      const doConnect = async () => {
        if (config.identityFile) {
          try {
            connectConfig.privateKey = await readFile(config.identityFile)
          } catch (err) {
            logger.warn({ identityFile: config.identityFile, err }, 'Failed to read identity file')
          }
        }

        if (!connectConfig.privateKey) {
          const password = await this.promptPassword(win)
          if (password === null) {
            reject(new Error('Authentication cancelled'))
            return
          }
          connectConfig.password = password
        }

        sshClient.on('ready', () => resolve())
        sshClient.on('error', (err: Error) => reject(err))
        sshClient.on('close', () => {
          const t = this.tunnels.get(tunnel.id)
          if (t && t.status === 'active') {
            t.status = 'error'
            t.error = 'SSH connection closed'
            if (t.server) {
              t.server.close()
              t.server = null
            }
            this.notifyStatusUpdate(t)
          }
        })

        sshClient.connect(connectConfig as never)
      }

      doConnect().catch(reject)
    })
  }

  private promptPassword(win: BrowserWindow | null): Promise<string | null> {
    return new Promise((resolve) => {
      if (!win || win.isDestroyed()) {
        resolve(null)
        return
      }
      const handler = (_event: Electron.IpcMainEvent, password: string) => {
        resolve(password || null)
      }
      ipcMain.once(TUNNEL_IPC.PASSWORD_RESPONSE, handler)
      win.webContents.send(TUNNEL_IPC.PASSWORD_PROMPT)
    })
  }

  private async setupForwarding(tunnel: ManagedTunnel): Promise<void> {
    switch (tunnel.config.type) {
      case 'local':
        await this.setupLocalForward(tunnel)
        break
      case 'remote':
        await this.setupRemoteForward(tunnel)
        break
      case 'dynamic':
        await this.setupDynamicForward(tunnel)
        break
    }
  }

  private setupLocalForward(tunnel: ManagedTunnel): Promise<void> {
    return new Promise((resolve, reject) => {
      const { config, sshClient } = tunnel

      const server = net.createServer((socket) => {
        tunnel.activeConnections++
        this.notifyStatusUpdate(tunnel)

        sshClient.forwardOut(
          '127.0.0.1',
          config.localPort,
          config.remoteHost,
          config.remotePort,
          (err, stream) => {
            if (err) {
              socket.destroy()
              tunnel.activeConnections--
              this.notifyStatusUpdate(tunnel)
              return
            }
            socket.pipe(stream).pipe(socket)
            stream.on('close', () => {
              socket.destroy()
              tunnel.activeConnections--
              this.notifyStatusUpdate(tunnel)
            })
            socket.on('close', () => {
              stream.destroy()
            })
          }
        )
      })

      server.on('error', (err) => {
        reject(err)
      })

      server.listen(config.localPort, '127.0.0.1', () => {
        tunnel.server = server
        resolve()
      })
    })
  }

  private setupRemoteForward(tunnel: ManagedTunnel): Promise<void> {
    return new Promise((resolve, reject) => {
      const { config, sshClient } = tunnel

      sshClient.forwardIn('0.0.0.0', config.remotePort, (err) => {
        if (err) {
          reject(err)
          return
        }

        sshClient.on('tcp connection', (info, accept) => {
          const stream = accept()
          const socket = net.connect(config.localPort, '127.0.0.1', () => {
            tunnel.activeConnections++
            this.notifyStatusUpdate(tunnel)

            socket.pipe(stream).pipe(socket)
            stream.on('close', () => {
              socket.destroy()
              tunnel.activeConnections--
              this.notifyStatusUpdate(tunnel)
            })
            socket.on('close', () => {
              stream.destroy()
            })
          })

          socket.on('error', () => {
            stream.destroy()
          })
        })

        // No local server for remote forwarding — set to null placeholder
        tunnel.server = null
        resolve()
      })
    })
  }

  private setupDynamicForward(tunnel: ManagedTunnel): Promise<void> {
    return new Promise((resolve, reject) => {
      const { config, sshClient } = tunnel

      const server = net.createServer((socket) => {
        // Minimal SOCKS5 handshake
        socket.once('data', (greeting) => {
          // Verify SOCKS5 greeting
          if (greeting[0] !== 0x05) {
            socket.destroy()
            return
          }

          // Respond: no auth required
          socket.write(Buffer.from([0x05, 0x00]))

          socket.once('data', (request) => {
            if (request[0] !== 0x05 || request[1] !== 0x01) {
              // Only support CONNECT
              socket.write(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
              socket.destroy()
              return
            }

            let destHost: string
            let destPort: number
            let offset: number

            const addrType = request[3]
            if (addrType === 0x01) {
              // IPv4
              destHost = `${request[4]}.${request[5]}.${request[6]}.${request[7]}`
              offset = 8
            } else if (addrType === 0x03) {
              // Domain
              const len = request[4]
              destHost = request.subarray(5, 5 + len).toString()
              offset = 5 + len
            } else if (addrType === 0x04) {
              // IPv6
              const parts: string[] = []
              for (let i = 4; i < 20; i += 2) {
                parts.push(request.readUInt16BE(i).toString(16))
              }
              destHost = parts.join(':')
              offset = 20
            } else {
              socket.write(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
              socket.destroy()
              return
            }

            destPort = request.readUInt16BE(offset)

            tunnel.activeConnections++
            this.notifyStatusUpdate(tunnel)

            sshClient.forwardOut(
              '127.0.0.1',
              config.localPort,
              destHost,
              destPort,
              (err, stream) => {
                if (err) {
                  socket.write(
                    Buffer.from([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
                  )
                  socket.destroy()
                  tunnel.activeConnections--
                  this.notifyStatusUpdate(tunnel)
                  return
                }

                // Success response
                socket.write(
                  Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
                )

                socket.pipe(stream).pipe(socket)
                stream.on('close', () => {
                  socket.destroy()
                  tunnel.activeConnections--
                  this.notifyStatusUpdate(tunnel)
                })
                socket.on('close', () => {
                  stream.destroy()
                })
              }
            )
          })
        })
      })

      server.on('error', (err) => {
        reject(err)
      })

      server.listen(config.localPort, '127.0.0.1', () => {
        tunnel.server = server
        resolve()
      })
    })
  }

  private notifyStatusUpdate(tunnel: ManagedTunnel): void {
    if (this.managerWindowId === null) return
    const win = BrowserWindow.fromId(this.managerWindowId)
    if (!win || win.isDestroyed()) {
      this.managerWindowId = null
      return
    }
    win.webContents.send(TUNNEL_IPC.STATUS_UPDATE, this.toInfo(tunnel))
  }

  private toInfo(tunnel: ManagedTunnel): TunnelInfo {
    return {
      id: tunnel.id,
      config: tunnel.config,
      status: tunnel.status,
      error: tunnel.error,
      activeConnections: tunnel.activeConnections
    }
  }
}

export const tunnelManager = new TunnelManager()
