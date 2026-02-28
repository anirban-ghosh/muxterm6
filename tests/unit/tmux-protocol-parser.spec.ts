import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TmuxProtocolParser } from '../../src/main/tmux/tmux-protocol-parser'
import type { CommandResponse, TmuxNotification } from '../../src/main/tmux/tmux-protocol-parser'

describe('TmuxProtocolParser', () => {
  let parser: TmuxProtocolParser

  beforeEach(() => {
    parser = new TmuxProtocolParser()
  })

  it('should parse %begin/%end response block', () => {
    const responses: CommandResponse[] = []
    parser.on('response', (r: CommandResponse) => responses.push(r))

    parser.feed('%begin 1234 1 0\n')
    parser.feed('line one\n')
    parser.feed('line two\n')
    parser.feed('%end 1234 1 0\n')

    expect(responses).toHaveLength(1)
    expect(responses[0].seqNumber).toBe(1234)
    expect(responses[0].success).toBe(true)
    expect(responses[0].lines).toEqual(['line one', 'line two'])
  })

  it('should parse %error response block', () => {
    const responses: CommandResponse[] = []
    parser.on('response', (r: CommandResponse) => responses.push(r))

    parser.feed('%begin 42 1 0\n')
    parser.feed('%error 42 1 0\n')

    expect(responses).toHaveLength(1)
    expect(responses[0].success).toBe(false)
    expect(responses[0].lines).toEqual([])
  })

  it('should parse %output notification', () => {
    const notifications: TmuxNotification[] = []
    parser.on('notification', (n: TmuxNotification) => notifications.push(n))

    parser.feed('%output %0 hello world\n')

    expect(notifications).toHaveLength(1)
    expect(notifications[0].type).toBe('output')
    expect(notifications[0].paneId).toBe('%0')
    expect(notifications[0].data).toBe('hello world')
  })

  it('should decode octal escapes in %output data', () => {
    const notifications: TmuxNotification[] = []
    parser.on('notification', (n: TmuxNotification) => notifications.push(n))

    parser.feed('%output %0 hello\\012world\n')

    expect(notifications[0].data).toBe('hello\nworld')
  })

  it('should parse %window-add notification', () => {
    const notifications: TmuxNotification[] = []
    parser.on('notification', (n: TmuxNotification) => notifications.push(n))

    parser.feed('%window-add @1\n')

    expect(notifications).toHaveLength(1)
    expect(notifications[0].type).toBe('window-add')
    expect(notifications[0].windowId).toBe('@1')
  })

  it('should parse %window-close notification', () => {
    const notifications: TmuxNotification[] = []
    parser.on('notification', (n: TmuxNotification) => notifications.push(n))

    parser.feed('%window-close @2\n')

    expect(notifications).toHaveLength(1)
    expect(notifications[0].type).toBe('window-close')
    expect(notifications[0].windowId).toBe('@2')
  })

  it('should parse %window-renamed notification', () => {
    const notifications: TmuxNotification[] = []
    parser.on('notification', (n: TmuxNotification) => notifications.push(n))

    parser.feed('%window-renamed @0 my-window\n')

    expect(notifications).toHaveLength(1)
    expect(notifications[0].type).toBe('window-renamed')
    expect(notifications[0].windowId).toBe('@0')
    expect(notifications[0].name).toBe('my-window')
  })

  it('should parse %layout-change notification', () => {
    const notifications: TmuxNotification[] = []
    parser.on('notification', (n: TmuxNotification) => notifications.push(n))

    parser.feed('%layout-change @0 d5a5,202x51,0,0,0\n')

    expect(notifications).toHaveLength(1)
    expect(notifications[0].type).toBe('layout-change')
    expect(notifications[0].windowId).toBe('@0')
    expect(notifications[0].layout).toBe('d5a5,202x51,0,0,0')
  })

  it('should parse %exit notification', () => {
    const notifications: TmuxNotification[] = []
    parser.on('notification', (n: TmuxNotification) => notifications.push(n))

    parser.feed('%exit\n')

    expect(notifications).toHaveLength(1)
    expect(notifications[0].type).toBe('exit')
  })

  it('should handle data split across multiple chunks', () => {
    const responses: CommandResponse[] = []
    parser.on('response', (r: CommandResponse) => responses.push(r))

    parser.feed('%beg')
    parser.feed('in 99 1 0\ndata ')
    parser.feed('line\n%end 99 1 0\n')

    expect(responses).toHaveLength(1)
    expect(responses[0].lines).toEqual(['data line'])
  })

  it('should handle multiple messages in one chunk', () => {
    const notifications: TmuxNotification[] = []
    parser.on('notification', (n: TmuxNotification) => notifications.push(n))

    parser.feed('%output %0 hello\n%output %1 world\n')

    expect(notifications).toHaveLength(2)
    expect(notifications[0].paneId).toBe('%0')
    expect(notifications[1].paneId).toBe('%1')
  })

  it('should reset state', () => {
    parser.feed('%begin 1 1 0\npartial ')
    parser.reset()

    const responses: CommandResponse[] = []
    parser.on('response', (r: CommandResponse) => responses.push(r))

    parser.feed('%begin 2 1 0\nfresh\n%end 2 1 0\n')
    expect(responses).toHaveLength(1)
    expect(responses[0].lines).toEqual(['fresh'])
  })
})
