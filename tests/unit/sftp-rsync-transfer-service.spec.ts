import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

// Track all spawned processes to control them individually
const spawnedProcesses: ReturnType<typeof createMockProcess>[] = []

function createMockProcess() {
  const proc = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    kill: vi.fn()
  })
  return proc
}

const mockSpawn = vi.fn().mockImplementation((..._args: unknown[]) => {
  const proc = createMockProcess()
  spawnedProcesses.push(proc)
  return proc
})

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args)
}))

const mockSend = vi.fn()
const mockFromId = vi.fn()

vi.mock('electron', () => ({
  BrowserWindow: {
    fromId: (...args: unknown[]) => mockFromId(...args)
  }
}))

const mockGetClient = vi.fn()
const mockGetConfig = vi.fn()

vi.mock('../../src/main/sftp/sftp-connection-manager', () => ({
  sftpConnectionManager: {
    getClient: (...args: unknown[]) => mockGetClient(...args),
    getConfig: (...args: unknown[]) => mockGetConfig(...args)
  }
}))

vi.mock('../../src/main/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

import { startTransfer, cancelTransfer } from '../../src/main/sftp/rsync-transfer-service'
import type { TransferRequest } from '@shared/sftp-types'

describe('rsync-transfer-service', () => {
  const mockWin = {
    isDestroyed: () => false,
    webContents: { send: mockSend }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    spawnedProcesses.length = 0
    mockFromId.mockReturnValue(mockWin)
    mockGetConfig.mockReturnValue({
      hostname: 'test.com',
      port: 22,
      username: 'user',
      identityFile: '/home/user/.ssh/id_rsa'
    })
  })

  // Helper: start a transfer and handle the rsync --version check.
  // Returns the rsync transfer process (second spawned process, or first if rsync check was cached).
  async function startTransferWithRsyncCheck(
    windowId: number,
    request: TransferRequest
  ): Promise<ReturnType<typeof createMockProcess>> {
    const promise = startTransfer(windowId, request)

    // Wait for spawn to happen
    await new Promise((r) => setTimeout(r, 10))

    // If a version check was spawned, complete it successfully
    if (spawnedProcesses.length > 0) {
      const firstProc = spawnedProcesses[0]
      // Check if this is the rsync --version check
      const firstCall = mockSpawn.mock.calls[0]
      if (firstCall && firstCall[0] === 'rsync' && firstCall[1]?.[0] === '--version') {
        firstProc.emit('close', 0)
        await new Promise((r) => setTimeout(r, 10))
      }
    }

    // The transfer process is the last one spawned
    const transferProc = spawnedProcesses[spawnedProcesses.length - 1]
    return transferProc
  }

  describe('parseRsyncProgress (tested via startTransfer)', () => {
    it('should parse standard rsync progress and send IPC event', async () => {
      const request: TransferRequest = {
        transferId: 'tx-1',
        sourcePath: '/local/file.txt',
        destPath: '/remote/file.txt',
        direction: 'upload',
        isDirectory: false
      }

      const proc = await startTransferWithRsyncCheck(1, request)

      proc.stdout.emit(
        'data',
        Buffer.from('  1,234,567  45%   1.23MB/s    0:01:23\n')
      )

      expect(mockSend).toHaveBeenCalledWith(
        'sftp:transfer-progress',
        expect.objectContaining({
          transferId: 'tx-1',
          filename: 'file.txt',
          bytesTransferred: 1234567,
          percentage: 45,
          speed: '1.23MB/s'
        })
      )

      proc.emit('close', 0)
    })

    it('should handle 100% complete line', async () => {
      const request: TransferRequest = {
        transferId: 'tx-2',
        sourcePath: '/local/data.bin',
        destPath: '/remote/data.bin',
        direction: 'upload',
        isDirectory: false
      }

      const proc = await startTransferWithRsyncCheck(1, request)

      proc.stdout.emit(
        'data',
        Buffer.from('  5,000,000 100%   10.00MB/s    0:00:00\n')
      )

      expect(mockSend).toHaveBeenCalledWith(
        'sftp:transfer-progress',
        expect.objectContaining({
          percentage: 100,
          bytesTransferred: 5000000
        })
      )

      proc.emit('close', 0)
    })

    it('should ignore non-progress lines', async () => {
      const request: TransferRequest = {
        transferId: 'tx-3',
        sourcePath: '/local/file.txt',
        destPath: '/remote/file.txt',
        direction: 'upload',
        isDirectory: false
      }

      const proc = await startTransferWithRsyncCheck(1, request)

      mockSend.mockClear()
      proc.stdout.emit('data', Buffer.from('sending incremental file list\nfile.txt\n'))

      expect(mockSend).not.toHaveBeenCalledWith(
        'sftp:transfer-progress',
        expect.anything()
      )

      proc.emit('close', 0)
    })
  })

  describe('rsync command construction', () => {
    it('should build correct upload command with user@host:path on dest', async () => {
      const request: TransferRequest = {
        transferId: 'tx-4',
        sourcePath: '/local/file.txt',
        destPath: '/remote/file.txt',
        direction: 'upload',
        isDirectory: false
      }

      await startTransferWithRsyncCheck(1, request)

      // Find the rsync transfer call (not the --version check)
      const transferCall = mockSpawn.mock.calls.find(
        (call: unknown[]) => call[0] === 'rsync' && call[1]?.[0] === '-avz'
      )
      expect(transferCall).toBeDefined()
      expect(transferCall![1]).toContain('/local/file.txt')
      expect(transferCall![1]).toContain('user@test.com:/remote/file.txt')

      spawnedProcesses[spawnedProcesses.length - 1].emit('close', 0)
    })

    it('should build correct download command with user@host:path on source', async () => {
      const request: TransferRequest = {
        transferId: 'tx-5',
        sourcePath: '/remote/file.txt',
        destPath: '/local/file.txt',
        direction: 'download',
        isDirectory: false
      }

      await startTransferWithRsyncCheck(1, request)

      const transferCall = mockSpawn.mock.calls.find(
        (call: unknown[]) => call[0] === 'rsync' && call[1]?.[0] === '-avz'
      )
      expect(transferCall).toBeDefined()
      expect(transferCall![1]).toContain('user@test.com:/remote/file.txt')
      expect(transferCall![1]).toContain('/local/file.txt')

      spawnedProcesses[spawnedProcesses.length - 1].emit('close', 0)
    })

    it('should include identity file via -i flag', async () => {
      const request: TransferRequest = {
        transferId: 'tx-6',
        sourcePath: '/local/file.txt',
        destPath: '/remote/file.txt',
        direction: 'upload',
        isDirectory: false
      }

      await startTransferWithRsyncCheck(1, request)

      const transferCall = mockSpawn.mock.calls.find(
        (call: unknown[]) => call[0] === 'rsync' && call[1]?.[0] === '-avz'
      )
      expect(transferCall).toBeDefined()
      const sshArg = transferCall![1][3] as string
      expect(sshArg).toContain('-i "/home/user/.ssh/id_rsa"')

      spawnedProcesses[spawnedProcesses.length - 1].emit('close', 0)
    })
  })

  describe('cancelTransfer', () => {
    it('should send SIGTERM to the process', async () => {
      const request: TransferRequest = {
        transferId: 'tx-cancel',
        sourcePath: '/local/file.txt',
        destPath: '/remote/file.txt',
        direction: 'upload',
        isDirectory: false
      }

      const proc = await startTransferWithRsyncCheck(1, request)

      cancelTransfer('tx-cancel')
      expect(proc.kill).toHaveBeenCalledWith('SIGTERM')
    })
  })

  describe('fallback to sftp client', () => {
    it('should use fastPut for upload when rsync unavailable', async () => {
      mockGetConfig.mockReturnValue(null) // No config triggers fallback

      const mockFastPut = vi.fn().mockResolvedValue(undefined)
      mockGetClient.mockReturnValue({ fastPut: mockFastPut, fastGet: vi.fn() })

      const request: TransferRequest = {
        transferId: 'tx-fallback-up',
        sourcePath: '/local/file.txt',
        destPath: '/remote/file.txt',
        direction: 'upload',
        isDirectory: false
      }

      await startTransfer(1, request)
      expect(mockFastPut).toHaveBeenCalledWith(
        '/local/file.txt',
        '/remote/file.txt',
        expect.objectContaining({ step: expect.any(Function) })
      )
    })

    it('should use fastGet for download when rsync unavailable', async () => {
      mockGetConfig.mockReturnValue(null)

      const mockFastGet = vi.fn().mockResolvedValue(undefined)
      mockGetClient.mockReturnValue({ fastPut: vi.fn(), fastGet: mockFastGet })

      const request: TransferRequest = {
        transferId: 'tx-fallback-down',
        sourcePath: '/remote/file.txt',
        destPath: '/local/file.txt',
        direction: 'download',
        isDirectory: false
      }

      await startTransfer(1, request)
      expect(mockFastGet).toHaveBeenCalledWith(
        '/remote/file.txt',
        '/local/file.txt',
        expect.objectContaining({ step: expect.any(Function) })
      )
    })
  })

  describe('transfer completion events', () => {
    it('should send transfer-complete on rsync exit code 0', async () => {
      const request: TransferRequest = {
        transferId: 'tx-ok',
        sourcePath: '/local/file.txt',
        destPath: '/remote/file.txt',
        direction: 'upload',
        isDirectory: false
      }

      const proc = await startTransferWithRsyncCheck(1, request)
      proc.emit('close', 0)

      // Allow async handling
      await new Promise((r) => setTimeout(r, 10))
      expect(mockSend).toHaveBeenCalledWith('sftp:transfer-complete', 'tx-ok')
    })

    it('should send transfer-error on rsync failure', async () => {
      const request: TransferRequest = {
        transferId: 'tx-fail',
        sourcePath: '/local/file.txt',
        destPath: '/remote/file.txt',
        direction: 'upload',
        isDirectory: false
      }

      const proc = await startTransferWithRsyncCheck(1, request)
      proc.emit('close', 1)

      await new Promise((r) => setTimeout(r, 10))
      expect(mockSend).toHaveBeenCalledWith(
        'sftp:transfer-error',
        'tx-fail',
        'rsync exited with code 1'
      )
    })
  })
})
