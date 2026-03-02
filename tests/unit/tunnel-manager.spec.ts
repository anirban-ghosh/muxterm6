import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp')
  },
  BrowserWindow: {
    fromId: vi.fn(() => ({
      isDestroyed: () => false,
      webContents: { send: vi.fn() }
    }))
  },
  ipcMain: {
    on: vi.fn(),
    once: vi.fn(),
    handle: vi.fn()
  }
}))

vi.mock('ssh2', () => ({
  Client: vi.fn(() => ({
    on: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    forwardOut: vi.fn(),
    forwardIn: vi.fn(),
    unforwardIn: vi.fn()
  }))
}))

vi.mock('net', () => ({
  createServer: vi.fn(() => ({
    listen: vi.fn(),
    close: vi.fn(),
    on: vi.fn()
  }))
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('fake-key'))
}))

vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-1')
}))

vi.mock('pino', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}))

// Import after mocks
import { tunnelManager } from '../../src/main/tunnel/tunnel-manager'

describe('TunnelManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await tunnelManager.destroyAll()
  })

  it('listTunnels returns empty array initially', () => {
    expect(tunnelManager.listTunnels()).toEqual([])
  })

  it('setManagerWindow sets the window ID without error', () => {
    tunnelManager.setManagerWindow(1)
    tunnelManager.setManagerWindow(null)
  })

  it('destroyAll handles empty state gracefully', async () => {
    await expect(tunnelManager.destroyAll()).resolves.not.toThrow()
  })

  it('destroyTunnel with unknown ID is no-op', async () => {
    await expect(tunnelManager.destroyTunnel('nonexistent')).resolves.not.toThrow()
  })

  it('pauseTunnel with unknown ID is no-op', async () => {
    await expect(tunnelManager.pauseTunnel('nonexistent')).resolves.not.toThrow()
  })

  it('resumeTunnel with unknown ID is no-op', async () => {
    await expect(tunnelManager.resumeTunnel('nonexistent')).resolves.not.toThrow()
  })
})
