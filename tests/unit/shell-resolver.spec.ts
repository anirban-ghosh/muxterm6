import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We need to mock fs before importing the module
vi.mock('fs', () => ({
  existsSync: vi.fn()
}))

import { existsSync } from 'fs'
import { resolveShell, getShellArgs } from '../../src/main/shell-resolver'

const mockExistsSync = vi.mocked(existsSync)

describe('shell-resolver', () => {
  const origEnv = { ...process.env }
  const origPlatform = process.platform

  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    process.env = { ...origEnv }
    Object.defineProperty(process, 'platform', { value: origPlatform })
  })

  describe('resolveShell', () => {
    it('should return $SHELL if it exists', () => {
      process.env.SHELL = '/usr/local/bin/fish'
      mockExistsSync.mockReturnValue(true)
      expect(resolveShell()).toBe('/usr/local/bin/fish')
    })

    it('should fall back to platform defaults when $SHELL is not set', () => {
      delete process.env.SHELL
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      mockExistsSync.mockImplementation((path) => path === '/bin/zsh')
      expect(resolveShell()).toBe('/bin/zsh')
    })

    it('should fall back to /bin/sh as last resort', () => {
      delete process.env.SHELL
      Object.defineProperty(process, 'platform', { value: 'linux' })
      mockExistsSync.mockImplementation((path) => path === '/bin/sh')
      expect(resolveShell()).toBe('/bin/sh')
    })
  })

  describe('getShellArgs', () => {
    it('should return --login on macOS', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      expect(getShellArgs('/bin/zsh')).toEqual(['--login'])
    })

    it('should return empty args on Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' })
      expect(getShellArgs('/bin/bash')).toEqual([])
    })
  })
})
