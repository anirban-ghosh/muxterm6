import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  stat: vi.fn(),
  rename: vi.fn(),
  cp: vi.fn(),
  rm: vi.fn(),
  mkdir: vi.fn()
}))

vi.mock('electron', () => ({
  shell: {
    openPath: vi.fn()
  }
}))

import { readdir, stat, rename, cp, rm, mkdir } from 'fs/promises'
import { shell } from 'electron'
import {
  localList,
  localRename,
  localCopy,
  localDelete,
  localMkdir,
  localExists,
  localHome,
  localOpenFile
} from '../../src/main/sftp/local-file-service'
import { homedir } from 'os'

const mockReaddir = vi.mocked(readdir)
const mockStat = vi.mocked(stat)
const mockRename = vi.mocked(rename)
const mockCp = vi.mocked(cp)
const mockRm = vi.mocked(rm)
const mockMkdir = vi.mocked(mkdir)
const mockOpenPath = vi.mocked(shell.openPath)

describe('local-file-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('localList', () => {
    it('should return sorted entries with directories first', async () => {
      mockReaddir.mockResolvedValue([
        { name: 'file.txt', isDirectory: () => false },
        { name: 'adir', isDirectory: () => true },
        { name: 'bfile.txt', isDirectory: () => false }
      ] as never)

      mockStat.mockResolvedValue({
        size: 100,
        mtimeMs: 1000,
        mode: 0o755
      } as never)

      const entries = await localList('/test')
      expect(entries).toHaveLength(3)
      // Directories first
      expect(entries[0].name).toBe('adir')
      expect(entries[0].isDirectory).toBe(true)
      // Then files alphabetically
      expect(entries[1].name).toBe('bfile.txt')
      expect(entries[2].name).toBe('file.txt')
    })

    it('should skip broken symlinks (stat failures)', async () => {
      mockReaddir.mockResolvedValue([
        { name: 'good.txt', isDirectory: () => false },
        { name: 'broken-link', isDirectory: () => false }
      ] as never)

      mockStat
        .mockResolvedValueOnce({ size: 50, mtimeMs: 1000, mode: 0o644 } as never)
        .mockRejectedValueOnce(new Error('ENOENT'))

      const entries = await localList('/test')
      expect(entries).toHaveLength(1)
      expect(entries[0].name).toBe('good.txt')
    })
  })

  describe('localRename', () => {
    it('should delegate to fs.rename', async () => {
      mockRename.mockResolvedValue(undefined)
      await localRename('/old/path', '/new/path')
      expect(mockRename).toHaveBeenCalledWith('/old/path', '/new/path')
    })
  })

  describe('localCopy', () => {
    it('should use cp with recursive option', async () => {
      mockCp.mockResolvedValue(undefined)
      await localCopy('/src/file', '/dest/file')
      expect(mockCp).toHaveBeenCalledWith('/src/file', '/dest/file', { recursive: true })
    })
  })

  describe('localDelete', () => {
    it('should delete a file without recursive', async () => {
      mockRm.mockResolvedValue(undefined)
      await localDelete('/test/file.txt', false)
      expect(mockRm).toHaveBeenCalledWith('/test/file.txt', { recursive: false, force: true })
    })

    it('should delete a directory with recursive', async () => {
      mockRm.mockResolvedValue(undefined)
      await localDelete('/test/dir', true)
      expect(mockRm).toHaveBeenCalledWith('/test/dir', { recursive: true, force: true })
    })
  })

  describe('localMkdir', () => {
    it('should create directory recursively', async () => {
      mockMkdir.mockResolvedValue(undefined as never)
      await localMkdir('/test/new/dir')
      expect(mockMkdir).toHaveBeenCalledWith('/test/new/dir', { recursive: true })
    })
  })

  describe('localExists', () => {
    it('should return "d" for directories', async () => {
      mockStat.mockResolvedValue({ isDirectory: () => true } as never)
      const result = await localExists('/test/dir')
      expect(result).toBe('d')
    })

    it('should return "-" for files', async () => {
      mockStat.mockResolvedValue({ isDirectory: () => false } as never)
      const result = await localExists('/test/file.txt')
      expect(result).toBe('-')
    })

    it('should return false when path does not exist', async () => {
      mockStat.mockRejectedValue(new Error('ENOENT'))
      const result = await localExists('/nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('localHome', () => {
    it('should return the home directory', () => {
      expect(localHome()).toBe(homedir())
    })
  })

  describe('localOpenFile', () => {
    it('should call shell.openPath', async () => {
      mockOpenPath.mockResolvedValue('')
      await localOpenFile('/test/file.txt')
      expect(mockOpenPath).toHaveBeenCalledWith('/test/file.txt')
    })
  })
})
