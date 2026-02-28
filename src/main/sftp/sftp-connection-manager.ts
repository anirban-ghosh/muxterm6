import SftpClient from 'ssh2-sftp-client'
import { readFile } from 'fs/promises'
import { BrowserWindow, ipcMain } from 'electron'
import { SFTP_IPC } from '@shared/sftp-ipc-channels'
import type { ConnectionConfig, FileEntry, HostKeyInfo } from '@shared/sftp-types'
import logger from '../logger'

interface ManagedConnection {
  client: SftpClient
  windowId: number
  config: ConnectionConfig
}

class SftpConnectionManager {
  private connections = new Map<string, ManagedConnection>()

  private connectionId(windowId: number): string {
    return `sftp-${windowId}`
  }

  async connect(windowId: number, config: ConnectionConfig): Promise<string> {
    const id = this.connectionId(windowId)

    // Disconnect existing connection for this window
    if (this.connections.has(id)) {
      await this.disconnect(windowId)
    }

    const client = new SftpClient()
    const win = BrowserWindow.fromId(windowId)

    const connectConfig: Record<string, unknown> = {
      host: config.hostname,
      port: config.port,
      username: config.username,
      readyTimeout: 10000,
      retries: 0
    }

    // Host key verification via IPC round-trip
    connectConfig.hostVerifier = (keyHash: string) => {
      return new Promise<boolean>((resolve) => {
        if (!win || win.isDestroyed()) {
          resolve(false)
          return
        }

        const info: HostKeyInfo = {
          hostname: config.hostname,
          fingerprint: keyHash,
          type: 'ssh-rsa'
        }

        const handler = (_event: Electron.IpcMainEvent, accepted: boolean) => {
          resolve(accepted)
        }
        // Listen for one response

        ipcMain.once(SFTP_IPC.HOST_KEY_RESPONSE, handler)
        win.webContents.send(SFTP_IPC.HOST_KEY_VERIFY, info)
      })
    }

    if (config.identityFile) {
      try {
        connectConfig.privateKey = await readFile(config.identityFile)
      } catch (err) {
        logger.warn({ identityFile: config.identityFile, err }, 'Failed to read identity file')
      }
    }

    // If no private key, prompt for password
    if (!connectConfig.privateKey) {
      const password = await this.promptPassword(win)
      if (password === null) {
        throw new Error('Authentication cancelled')
      }
      connectConfig.password = password
    }

    try {
      await client.connect(connectConfig as never)
    } catch (err: unknown) {
      // If key auth failed, try password
      if (
        connectConfig.privateKey &&
        err instanceof Error &&
        (err.message.includes('authentication') || err.message.includes('All configured'))
      ) {
        const password = await this.promptPassword(win)
        if (password === null) {
          throw new Error('Authentication cancelled')
        }
        delete connectConfig.privateKey
        connectConfig.password = password
        await client.connect(connectConfig as never)
      } else {
        throw err
      }
    }

    this.connections.set(id, { client, windowId, config })
    logger.info({ id, hostname: config.hostname }, 'SFTP connected')
    return id
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
      ipcMain.once(SFTP_IPC.PASSWORD_RESPONSE, handler)
      win.webContents.send(SFTP_IPC.PASSWORD_PROMPT)
    })
  }

  async disconnect(windowId: number): Promise<void> {
    const id = this.connectionId(windowId)
    const conn = this.connections.get(id)
    if (conn) {
      try {
        await conn.client.end()
      } catch {
        // Ignore errors on disconnect
      }
      this.connections.delete(id)
      logger.info({ id }, 'SFTP disconnected')
    }
  }

  async list(windowId: number, remotePath: string): Promise<FileEntry[]> {
    const client = this.getClient(windowId)
    const listing = await client.list(remotePath)

    const filtered = listing.filter((item) => item.name !== '.' && item.name !== '..')

    const entries: FileEntry[] = await Promise.all(
      filtered.map(async (item) => {
        const fullPath = remotePath === '/' ? `/${item.name}` : `${remotePath}/${item.name}`

        let isDirectory: boolean
        if (item.type === 'l') {
          // Symlink — resolve via stat to determine if target is a directory
          try {
            const stat = await client.stat(fullPath)
            isDirectory = stat.isDirectory
          } catch {
            // Broken symlink — treat as file
            isDirectory = false
          }
        } else {
          isDirectory = item.type === 'd'
        }

        return {
          name: item.name,
          path: fullPath,
          isDirectory,
          size: item.size,
          modifiedAt: item.modifyTime,
          permissions: item.rights
            ? `${item.rights.user}${item.rights.group}${item.rights.other}`
            : '---'
        }
      })
    )

    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return entries
  }

  async remoteRename(windowId: number, oldPath: string, newPath: string): Promise<void> {
    const client = this.getClient(windowId)
    await client.rename(oldPath, newPath)
  }

  async remoteDelete(windowId: number, remotePath: string, isDir: boolean): Promise<void> {
    const client = this.getClient(windowId)
    if (isDir) {
      await client.rmdir(remotePath, true)
    } else {
      await client.delete(remotePath)
    }
  }

  async remoteMkdir(windowId: number, remotePath: string): Promise<void> {
    const client = this.getClient(windowId)
    await client.mkdir(remotePath, true)
  }

  async remoteExists(windowId: number, remotePath: string): Promise<false | 'd' | '-'> {
    const client = this.getClient(windowId)
    const result = await client.exists(remotePath)
    return result
  }

  async remoteHome(windowId: number): Promise<string> {
    const client = this.getClient(windowId)
    return await client.cwd()
  }

  getClient(windowId: number): SftpClient {
    const id = this.connectionId(windowId)
    const conn = this.connections.get(id)
    if (!conn) {
      throw new Error('No SFTP connection for this window')
    }
    return conn.client
  }

  getConfig(windowId: number): ConnectionConfig | undefined {
    const id = this.connectionId(windowId)
    return this.connections.get(id)?.config
  }

  isConnected(windowId: number): boolean {
    const id = this.connectionId(windowId)
    return this.connections.has(id)
  }
}

export const sftpConnectionManager = new SftpConnectionManager()
