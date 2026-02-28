import { describe, it, expect } from 'vitest'
import { SFTP_IPC } from '@shared/sftp-ipc-channels'

describe('SFTP IPC channels', () => {
  it('all channel values should be unique', () => {
    const values = Object.values(SFTP_IPC)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('all channel values should start with sftp:', () => {
    for (const value of Object.values(SFTP_IPC)) {
      expect(value).toMatch(/^sftp:/)
    }
  })

  it('should have the expected number of channels', () => {
    const keys = Object.keys(SFTP_IPC)
    // 3 connection + 6 remote + 8 local + 2 transfer + 3 transfer events + 4 auth + 1 window = 27
    expect(keys).toHaveLength(27)
  })
})
