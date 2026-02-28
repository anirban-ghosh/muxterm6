/**
 * FIFO queue that sends commands to the tmux control PTY and correlates
 * %begin/%end responses by sequence number.
 *
 * Each command gets a unique sequence number. The queue sends one command
 * at a time and waits for its response before sending the next.
 */

import type { TmuxProtocolParser, CommandResponse } from './tmux-protocol-parser'
import logger from '../logger'

interface QueuedCommand {
  command: string
  resolve: (lines: string[]) => void
  reject: (error: Error) => void
}

export class TmuxCommandQueue {
  private queue: QueuedCommand[] = []
  private pending: QueuedCommand | null = null
  private seqNumber = 0
  private writeFn: (data: string) => void

  constructor(
    parser: TmuxProtocolParser,
    writeFn: (data: string) => void
  ) {
    this.writeFn = writeFn

    parser.on('response', (response: CommandResponse) => {
      this.handleResponse(response)
    })
  }

  /**
   * Send a command to tmux and return a promise that resolves with the response lines.
   */
  send(command: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.queue.push({ command, resolve, reject })
      this.flush()
    })
  }

  private flush(): void {
    if (this.pending || this.queue.length === 0) return

    this.pending = this.queue.shift()!
    this.seqNumber++

    const cmd = this.pending.command
    logger.debug({ cmd, seq: this.seqNumber }, 'tmux command sent')
    this.writeFn(cmd + '\n')
  }

  private handleResponse(response: CommandResponse): void {
    if (!this.pending) {
      logger.warn({ response }, 'tmux response received with no pending command')
      return
    }

    const cmd = this.pending
    this.pending = null

    if (response.success) {
      cmd.resolve(response.lines)
    } else {
      cmd.reject(new Error(`tmux command failed: ${response.lines.join('\n')}`))
    }

    this.flush()
  }

  /**
   * Reject all pending and queued commands.
   */
  dispose(): void {
    const error = new Error('TmuxCommandQueue disposed')
    if (this.pending) {
      this.pending.reject(error)
      this.pending = null
    }
    for (const cmd of this.queue) {
      cmd.reject(error)
    }
    this.queue = []
  }
}
