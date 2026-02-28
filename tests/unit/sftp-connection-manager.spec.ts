import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to ensure mock fns exist before vi.mock factories run
const {
  mockConnect, mockEnd, mockList, mockRename, mockDelete,
  mockRmdir, mockMkdir, mockExists, mockCwd,
  mockReadFile, mockSend, mockFromId, mockOnce
} = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockEnd: vi.fn(),
  mockList: vi.fn(),
  mockRename: vi.fn(),
  mockDelete: vi.fn(),
  mockRmdir: vi.fn(),
  mockMkdir: vi.fn(),
  mockExists: vi.fn(),
  mockCwd: vi.fn(),
  mockReadFile: vi.fn(),
  mockSend: vi.fn(),
  mockFromId: vi.fn(),
  mockOnce: vi.fn()
}))

vi.mock('ssh2-sftp-client', () => ({
  default: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    end: mockEnd,
    list: mockList,
    rename: mockRename,
    delete: mockDelete,
    rmdir: mockRmdir,
    mkdir: mockMkdir,
    exists: mockExists,
    cwd: mockCwd
  }))
}))

vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args)
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    fromId: (...args: unknown[]) => mockFromId(...args)
  },
  ipcMain: {
    once: (...args: unknown[]) => mockOnce(...args)
  }
}))

vi.mock('../../src/main/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

import { sftpConnectionManager } from '../../src/main/sftp/sftp-connection-manager'
import type { ConnectionConfig } from '@shared/sftp-types'

describe('SftpConnectionManager', () => {
  const defaultConfig: ConnectionConfig = {
    hostname: 'test.example.com',
    port: 22,
    username: 'testuser',
    identityFile: '/home/user/.ssh/id_rsa'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFromId.mockReturnValue({
      isDestroyed: () => false,
      webContents: { send: mockSend }
    })
    mockConnect.mockResolvedValue(undefined)
    mockEnd.mockResolvedValue(undefined)
    mockReadFile.mockResolvedValue(Buffer.from('fake-private-key'))
    // Auto-accept host key
    mockOnce.mockImplementation((_channel: string, handler: Function) => {
      handler({}, true)
    })
  })

  describe('connect', () => {
    it('should create client and call connect', async () => {
      const id = await sftpConnectionManager.connect(1, defaultConfig)
      expect(id).toBe('sftp-1')
      expect(mockConnect).toHaveBeenCalledTimes(1)
    })

    it('should read private key from identityFile', async () => {
      await sftpConnectionManager.connect(2, defaultConfig)
      expect(mockReadFile).toHaveBeenCalledWith('/home/user/.ssh/id_rsa')
      await sftpConnectionManager.disconnect(2)
    })

    it('should prompt for password when no identity file', async () => {
      const configNoKey: ConnectionConfig = {
        hostname: 'test.example.com',
        port: 22,
        username: 'testuser'
      }

      mockOnce.mockImplementation((channel: string, handler: Function) => {
        if (channel === 'sftp:password-response') {
          handler({}, 'mypassword')
        } else {
          handler({}, true)
        }
      })

      await sftpConnectionManager.connect(3, configNoKey)
      expect(mockSend).toHaveBeenCalledWith('sftp:password-prompt')
      await sftpConnectionManager.disconnect(3)
    })
  })

  describe('disconnect', () => {
    it('should call client.end and clean up', async () => {
      await sftpConnectionManager.connect(10, defaultConfig)
      expect(sftpConnectionManager.isConnected(10)).toBe(true)

      await sftpConnectionManager.disconnect(10)
      expect(mockEnd).toHaveBeenCalled()
      expect(sftpConnectionManager.isConnected(10)).toBe(false)
    })

    it('should be idempotent for unknown window', async () => {
      await sftpConnectionManager.disconnect(999)
    })
  })

  describe('list', () => {
    it('should return mapped FileEntry array sorted dirs first', async () => {
      await sftpConnectionManager.connect(20, defaultConfig)

      mockList.mockResolvedValue([
        {
          name: 'file.txt',
          type: '-',
          size: 100,
          modifyTime: 1000,
          rights: { user: 'rw-', group: 'r--', other: 'r--' }
        },
        { name: '.', type: 'd', size: 0, modifyTime: 0, rights: null },
        { name: '..', type: 'd', size: 0, modifyTime: 0, rights: null },
        {
          name: 'subdir',
          type: 'd',
          size: 4096,
          modifyTime: 2000,
          rights: { user: 'rwx', group: 'r-x', other: 'r-x' }
        }
      ])

      const entries = await sftpConnectionManager.list(20, '/home')
      expect(entries).toHaveLength(2)
      expect(entries[0].name).toBe('subdir')
      expect(entries[0].isDirectory).toBe(true)
      expect(entries[1].name).toBe('file.txt')
      expect(entries[1].isDirectory).toBe(false)

      await sftpConnectionManager.disconnect(20)
    })
  })

  describe('remoteRename', () => {
    it('should delegate to client.rename', async () => {
      await sftpConnectionManager.connect(30, defaultConfig)
      mockRename.mockResolvedValue(undefined)

      await sftpConnectionManager.remoteRename(30, '/old', '/new')
      expect(mockRename).toHaveBeenCalledWith('/old', '/new')

      await sftpConnectionManager.disconnect(30)
    })
  })

  describe('remoteDelete', () => {
    it('should call delete for files', async () => {
      await sftpConnectionManager.connect(40, defaultConfig)
      mockDelete.mockResolvedValue(undefined)

      await sftpConnectionManager.remoteDelete(40, '/file.txt', false)
      expect(mockDelete).toHaveBeenCalledWith('/file.txt')

      await sftpConnectionManager.disconnect(40)
    })

    it('should call rmdir with recursive for directories', async () => {
      await sftpConnectionManager.connect(41, defaultConfig)
      mockRmdir.mockResolvedValue(undefined)

      await sftpConnectionManager.remoteDelete(41, '/mydir', true)
      expect(mockRmdir).toHaveBeenCalledWith('/mydir', true)

      await sftpConnectionManager.disconnect(41)
    })
  })

  describe('remoteMkdir', () => {
    it('should call client.mkdir with recursive', async () => {
      await sftpConnectionManager.connect(50, defaultConfig)
      mockMkdir.mockResolvedValue(undefined)

      await sftpConnectionManager.remoteMkdir(50, '/new/dir')
      expect(mockMkdir).toHaveBeenCalledWith('/new/dir', true)

      await sftpConnectionManager.disconnect(50)
    })
  })

  describe('remoteExists', () => {
    it('should return correct type', async () => {
      await sftpConnectionManager.connect(60, defaultConfig)

      mockExists.mockResolvedValue('d')
      expect(await sftpConnectionManager.remoteExists(60, '/dir')).toBe('d')

      mockExists.mockResolvedValue('-')
      expect(await sftpConnectionManager.remoteExists(60, '/file')).toBe('-')

      mockExists.mockResolvedValue(false)
      expect(await sftpConnectionManager.remoteExists(60, '/none')).toBe(false)

      await sftpConnectionManager.disconnect(60)
    })
  })

  describe('remoteHome', () => {
    it('should call client.cwd', async () => {
      await sftpConnectionManager.connect(70, defaultConfig)
      mockCwd.mockResolvedValue('/home/testuser')

      const home = await sftpConnectionManager.remoteHome(70)
      expect(home).toBe('/home/testuser')
      expect(mockCwd).toHaveBeenCalled()

      await sftpConnectionManager.disconnect(70)
    })
  })

  describe('getClient', () => {
    it('should throw for unconnected window', () => {
      expect(() => sftpConnectionManager.getClient(999)).toThrow(
        'No SFTP connection for this window'
      )
    })
  })

  describe('isConnected', () => {
    it('should return false before connect and true after', async () => {
      expect(sftpConnectionManager.isConnected(80)).toBe(false)
      await sftpConnectionManager.connect(80, defaultConfig)
      expect(sftpConnectionManager.isConnected(80)).toBe(true)
      await sftpConnectionManager.disconnect(80)
      expect(sftpConnectionManager.isConnected(80)).toBe(false)
    })
  })
})
