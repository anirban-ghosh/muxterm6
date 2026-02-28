import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs/promises', () => ({
  readFile: vi.fn()
}))

import { readFile } from 'fs/promises'
import { parseSshConfig } from '../../src/main/sftp/ssh-config-parser'
import { homedir } from 'os'

const mockReadFile = vi.mocked(readFile)

describe('parseSshConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should parse a basic host entry', async () => {
    mockReadFile.mockResolvedValue(
      'Host myserver\n  HostName 192.168.1.1\n  Port 2222\n  User admin\n  IdentityFile ~/.ssh/id_rsa\n'
    )

    const hosts = await parseSshConfig()
    expect(hosts).toHaveLength(1)
    expect(hosts[0]).toEqual({
      host: 'myserver',
      hostname: '192.168.1.1',
      port: 2222,
      user: 'admin',
      identityFile: expect.stringContaining('.ssh/id_rsa')
    })
  })

  it('should parse multiple hosts', async () => {
    mockReadFile.mockResolvedValue(
      'Host server1\n  HostName 10.0.0.1\n\nHost server2\n  HostName 10.0.0.2\n  Port 3333\n'
    )

    const hosts = await parseSshConfig()
    expect(hosts).toHaveLength(2)
    expect(hosts[0].host).toBe('server1')
    expect(hosts[1].host).toBe('server2')
    expect(hosts[1].port).toBe(3333)
  })

  it('should skip wildcard hosts', async () => {
    mockReadFile.mockResolvedValue(
      'Host *\n  ServerAliveInterval 60\n\nHost *.example.com\n  User deploy\n\nHost realhost\n  HostName 1.2.3.4\n'
    )

    const hosts = await parseSshConfig()
    expect(hosts).toHaveLength(1)
    expect(hosts[0].host).toBe('realhost')
  })

  it('should handle missing fields with defaults', async () => {
    mockReadFile.mockResolvedValue('Host minimal\n  HostName example.com\n')

    const hosts = await parseSshConfig()
    expect(hosts).toHaveLength(1)
    expect(hosts[0]).toEqual({
      host: 'minimal',
      hostname: 'example.com',
      port: 22,
      user: '',
      identityFile: undefined
    })
  })

  it('should expand tilde in IdentityFile', async () => {
    mockReadFile.mockResolvedValue(
      'Host test\n  HostName test.com\n  IdentityFile ~/keys/mykey\n'
    )

    const hosts = await parseSshConfig()
    expect(hosts[0].identityFile).toContain(homedir())
    expect(hosts[0].identityFile).not.toContain('~')
  })

  it('should skip comments and blank lines', async () => {
    mockReadFile.mockResolvedValue(
      '# This is a comment\n\n  \nHost server\n  # Another comment\n  HostName 10.0.0.1\n\n'
    )

    const hosts = await parseSshConfig()
    expect(hosts).toHaveLength(1)
    expect(hosts[0].hostname).toBe('10.0.0.1')
  })

  it('should return empty array when config file is missing', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'))

    const hosts = await parseSshConfig()
    expect(hosts).toEqual([])
  })

  it('should take first token from multi-word Host line', async () => {
    mockReadFile.mockResolvedValue(
      'Host server1 server1-alias\n  HostName 10.0.0.1\n'
    )

    const hosts = await parseSshConfig()
    expect(hosts).toHaveLength(1)
    expect(hosts[0].host).toBe('server1')
  })

  it('should handle case-insensitive keywords', async () => {
    mockReadFile.mockResolvedValue(
      'Host test\n  hostname myhost.com\n  port 9999\n  user myuser\n  identityfile ~/.ssh/key\n'
    )

    const hosts = await parseSshConfig()
    expect(hosts).toHaveLength(1)
    expect(hosts[0].hostname).toBe('myhost.com')
    expect(hosts[0].port).toBe(9999)
    expect(hosts[0].user).toBe('myuser')
    expect(hosts[0].identityFile).toBeDefined()
  })

  it('should use host as hostname when HostName is missing', async () => {
    mockReadFile.mockResolvedValue('Host myhost\n  Port 22\n')

    const hosts = await parseSshConfig()
    expect(hosts).toHaveLength(1)
    expect(hosts[0].hostname).toBe('myhost')
  })
})
