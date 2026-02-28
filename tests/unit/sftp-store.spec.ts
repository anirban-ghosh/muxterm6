import { describe, it, expect, beforeEach } from 'vitest'
import { useSftpStore } from '../../src/renderer/store/sftp'
import type { FileEntry, TransferProgress, HostKeyInfo } from '@shared/sftp-types'

describe('useSftpStore', () => {
  beforeEach(() => {
    useSftpStore.getState().reset()
  })

  describe('initial state', () => {
    it('should have correct defaults', () => {
      const state = useSftpStore.getState()
      expect(state.connected).toBe(false)
      expect(state.connecting).toBe(false)
      expect(state.connectionError).toBeNull()
      expect(state.connectionConfig).toBeNull()
      expect(state.localPath).toBe('')
      expect(state.localFiles).toEqual([])
      expect(state.localLoading).toBe(false)
      expect(state.localSelection.size).toBe(0)
      expect(state.remotePath).toBe('')
      expect(state.remoteFiles).toEqual([])
      expect(state.remoteLoading).toBe(false)
      expect(state.remoteSelection.size).toBe(0)
      expect(state.clipboard).toBeNull()
      expect(state.transfers.size).toBe(0)
      expect(state.showConnectionDialog).toBe(false)
      expect(state.hostKeyInfo).toBeNull()
      expect(state.showPasswordDialog).toBe(false)
      expect(state.conflictInfo).toBeNull()
    })
  })

  describe('connection state', () => {
    it('setConnected / setConnecting', () => {
      useSftpStore.getState().setConnecting(true)
      expect(useSftpStore.getState().connecting).toBe(true)

      useSftpStore.getState().setConnected(true)
      expect(useSftpStore.getState().connected).toBe(true)

      useSftpStore.getState().setConnected(false)
      expect(useSftpStore.getState().connected).toBe(false)
    })

    it('setConnectionError sets and clears', () => {
      useSftpStore.getState().setConnectionError('Connection refused')
      expect(useSftpStore.getState().connectionError).toBe('Connection refused')

      useSftpStore.getState().setConnectionError(null)
      expect(useSftpStore.getState().connectionError).toBeNull()
    })
  })

  describe('local pane state', () => {
    it('setLocalPath', () => {
      useSftpStore.getState().setLocalPath('/home/user')
      expect(useSftpStore.getState().localPath).toBe('/home/user')
    })

    it('setLocalFiles', () => {
      const files: FileEntry[] = [
        {
          name: 'test.txt',
          path: '/test.txt',
          isDirectory: false,
          size: 100,
          modifiedAt: 1000,
          permissions: 'rw-r--r--'
        }
      ]
      useSftpStore.getState().setLocalFiles(files)
      expect(useSftpStore.getState().localFiles).toEqual(files)
    })

    it('setLocalSelection', () => {
      const sel = new Set(['file1.txt', 'file2.txt'])
      useSftpStore.getState().setLocalSelection(sel)
      expect(useSftpStore.getState().localSelection).toEqual(sel)
    })
  })

  describe('remote pane state', () => {
    it('setRemotePath', () => {
      useSftpStore.getState().setRemotePath('/var/www')
      expect(useSftpStore.getState().remotePath).toBe('/var/www')
    })

    it('setRemoteFiles', () => {
      const files: FileEntry[] = [
        {
          name: 'index.html',
          path: '/var/www/index.html',
          isDirectory: false,
          size: 500,
          modifiedAt: 2000,
          permissions: 'rw-r--r--'
        }
      ]
      useSftpStore.getState().setRemoteFiles(files)
      expect(useSftpStore.getState().remoteFiles).toEqual(files)
    })

    it('setRemoteSelection', () => {
      const sel = new Set(['/var/www/file.html'])
      useSftpStore.getState().setRemoteSelection(sel)
      expect(useSftpStore.getState().remoteSelection).toEqual(sel)
    })
  })

  describe('clipboard', () => {
    it('setClipboard sets and clears', () => {
      const files: FileEntry[] = [
        {
          name: 'copy.txt',
          path: '/copy.txt',
          isDirectory: false,
          size: 10,
          modifiedAt: 0,
          permissions: 'rw-'
        }
      ]

      useSftpStore.getState().setClipboard({
        files,
        operation: 'copy',
        source: 'local'
      })

      const clip = useSftpStore.getState().clipboard
      expect(clip).not.toBeNull()
      expect(clip!.operation).toBe('copy')
      expect(clip!.source).toBe('local')
      expect(clip!.files).toHaveLength(1)

      useSftpStore.getState().setClipboard(null)
      expect(useSftpStore.getState().clipboard).toBeNull()
    })
  })

  describe('transfers', () => {
    it('updateTransfer adds/updates in map', () => {
      const progress: TransferProgress = {
        transferId: 'tx-1',
        filename: 'file.txt',
        bytesTransferred: 500,
        totalBytes: 1000,
        percentage: 50,
        speed: '1MB/s'
      }

      useSftpStore.getState().updateTransfer(progress)
      expect(useSftpStore.getState().transfers.get('tx-1')).toEqual(progress)

      // Update existing
      const updated = { ...progress, percentage: 75, bytesTransferred: 750 }
      useSftpStore.getState().updateTransfer(updated)
      expect(useSftpStore.getState().transfers.get('tx-1')!.percentage).toBe(75)
    })

    it('removeTransfer deletes from map', () => {
      const progress: TransferProgress = {
        transferId: 'tx-rm',
        filename: 'file.txt',
        bytesTransferred: 1000,
        totalBytes: 1000,
        percentage: 100,
        speed: ''
      }

      useSftpStore.getState().updateTransfer(progress)
      expect(useSftpStore.getState().transfers.has('tx-rm')).toBe(true)

      useSftpStore.getState().removeTransfer('tx-rm')
      expect(useSftpStore.getState().transfers.has('tx-rm')).toBe(false)
    })
  })

  describe('dialog state', () => {
    it('setShowConnectionDialog', () => {
      useSftpStore.getState().setShowConnectionDialog(true)
      expect(useSftpStore.getState().showConnectionDialog).toBe(true)
    })

    it('setHostKeyInfo', () => {
      const info: HostKeyInfo = {
        hostname: 'example.com',
        fingerprint: 'SHA256:abc123',
        type: 'ssh-rsa'
      }
      useSftpStore.getState().setHostKeyInfo(info)
      expect(useSftpStore.getState().hostKeyInfo).toEqual(info)

      useSftpStore.getState().setHostKeyInfo(null)
      expect(useSftpStore.getState().hostKeyInfo).toBeNull()
    })

    it('setShowPasswordDialog', () => {
      useSftpStore.getState().setShowPasswordDialog(true)
      expect(useSftpStore.getState().showPasswordDialog).toBe(true)
    })
  })

  describe('reset', () => {
    it('should restore initial state after mutations', () => {
      // Mutate everything
      useSftpStore.getState().setConnected(true)
      useSftpStore.getState().setConnecting(true)
      useSftpStore.getState().setConnectionError('error')
      useSftpStore.getState().setLocalPath('/some/path')
      useSftpStore.getState().setRemotePath('/remote/path')
      useSftpStore.getState().setShowConnectionDialog(true)
      useSftpStore.getState().updateTransfer({
        transferId: 'tx',
        filename: 'f',
        bytesTransferred: 0,
        totalBytes: 0,
        percentage: 0,
        speed: ''
      })

      useSftpStore.getState().reset()

      const state = useSftpStore.getState()
      expect(state.connected).toBe(false)
      expect(state.connecting).toBe(false)
      expect(state.connectionError).toBeNull()
      expect(state.localPath).toBe('')
      expect(state.remotePath).toBe('')
      expect(state.showConnectionDialog).toBe(false)
      expect(state.transfers.size).toBe(0)
    })
  })
})
