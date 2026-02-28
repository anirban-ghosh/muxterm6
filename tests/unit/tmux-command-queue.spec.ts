import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the logger before importing modules that use it
vi.mock('../../src/main/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

import { TmuxProtocolParser } from '../../src/main/tmux/tmux-protocol-parser'
import { TmuxCommandQueue } from '../../src/main/tmux/tmux-command-queue'

describe('TmuxCommandQueue', () => {
  let parser: TmuxProtocolParser
  let queue: TmuxCommandQueue
  let written: string[]

  beforeEach(() => {
    parser = new TmuxProtocolParser()
    written = []
    queue = new TmuxCommandQueue(parser, (data) => written.push(data))
  })

  it('should send a command and resolve on success', async () => {
    const promise = queue.send('list-windows')

    expect(written).toEqual(['list-windows\n'])

    // Simulate tmux response
    parser.feed('%begin 1 1 0\n@0 bash\n@1 vim\n%end 1 1 0\n')

    const result = await promise
    expect(result).toEqual(['@0 bash', '@1 vim'])
  })

  it('should reject on error response', async () => {
    const promise = queue.send('bad-command')

    parser.feed('%begin 1 1 0\n%error 1 1 0\n')

    await expect(promise).rejects.toThrow('tmux command failed')
  })

  it('should queue multiple commands and process sequentially', async () => {
    const p1 = queue.send('cmd1')
    const p2 = queue.send('cmd2')

    // Only first command should be sent
    expect(written).toEqual(['cmd1\n'])

    // Respond to first command
    parser.feed('%begin 1 1 0\nresult1\n%end 1 1 0\n')
    const r1 = await p1
    expect(r1).toEqual(['result1'])

    // Second command should now be sent
    expect(written).toEqual(['cmd1\n', 'cmd2\n'])

    // Respond to second command
    parser.feed('%begin 2 1 0\nresult2\n%end 2 1 0\n')
    const r2 = await p2
    expect(r2).toEqual(['result2'])
  })

  it('should reject all pending on dispose', async () => {
    const p1 = queue.send('cmd1')
    const p2 = queue.send('cmd2')

    queue.dispose()

    await expect(p1).rejects.toThrow('disposed')
    await expect(p2).rejects.toThrow('disposed')
  })
})
