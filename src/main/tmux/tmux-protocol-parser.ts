/**
 * Line-buffered state machine for tmux control mode protocol.
 *
 * Tmux control mode sends protocol messages line-by-line:
 * - %begin SEQ FLAGS CMD_NUMBER
 * - ...response lines...
 * - %end SEQ FLAGS CMD_NUMBER
 * - %error SEQ FLAGS CMD_NUMBER
 * - %output %PANE DATA
 * - %window-add @ID
 * - %window-close @ID
 * - %window-renamed @ID NAME
 * - %layout-change @ID LAYOUT
 * - %exit [REASON]
 *
 * Real newlines in %output data are octal-escaped (\012), so \n always
 * delimits protocol lines.
 */

import { EventEmitter } from 'events'
import { decodeOctalEscapes } from './tmux-escape'

export interface CommandResponse {
  seqNumber: number
  success: boolean
  lines: string[]
}

export type TmuxNotificationType =
  | 'output'
  | 'window-add'
  | 'window-close'
  | 'window-renamed'
  | 'layout-change'
  | 'exit'
  | 'session-changed'
  | 'pane-mode-changed'

export interface TmuxNotification {
  type: TmuxNotificationType
  paneId?: string
  windowId?: string
  data?: string
  layout?: string
  name?: string
  reason?: string
}

export class TmuxProtocolParser extends EventEmitter {
  private buffer = ''
  private inBlock = false
  private blockSeq = -1
  private blockLines: string[] = []
  private blockIsError = false

  private exited = false

  /**
   * Feed raw data from the PTY into the parser.
   * Returns any remaining data that should be sent to the renderer
   * (e.g. shell output after %exit).
   */
  feed(data: string): string | null {
    if (this.exited) {
      // After %exit, all data is raw shell output
      return data
    }
    this.buffer += data
    this.processLines()
    if (this.exited) {
      // %exit was encountered during processing — return remaining buffer as raw data
      const remaining = this.buffer
      this.buffer = ''
      return remaining.length > 0 ? remaining : null
    }
    return null
  }

  private processLines(): void {
    let nlIndex: number
    while (!this.exited && (nlIndex = this.buffer.indexOf('\n')) !== -1) {
      let line = this.buffer.substring(0, nlIndex)
      this.buffer = this.buffer.substring(nlIndex + 1)
      // Strip trailing \r — tmux control mode may send \r\n line endings
      if (line.endsWith('\r')) {
        line = line.substring(0, line.length - 1)
      }
      this.parseLine(line)
    }
  }

  private parseLine(line: string): void {
    // Inside a %begin..%end block
    if (this.inBlock) {
      if (line.startsWith('%end ') || line.startsWith('%error ')) {
        const isError = line.startsWith('%error ')
        const parts = line.split(' ')
        const seq = parseInt(parts[1], 10)
        if (seq === this.blockSeq) {
          this.emit('response', {
            seqNumber: this.blockSeq,
            success: !isError && !this.blockIsError,
            lines: this.blockLines
          } as CommandResponse)
          this.inBlock = false
          this.blockLines = []
          this.blockSeq = -1
          this.blockIsError = false
        }
        return
      }
      this.blockLines.push(line)
      return
    }

    // %begin SEQ FLAGS CMD_NUMBER
    if (line.startsWith('%begin ')) {
      const parts = line.split(' ')
      this.blockSeq = parseInt(parts[1], 10)
      this.inBlock = true
      this.blockLines = []
      this.blockIsError = false
      return
    }

    // %output %PANE DATA
    if (line.startsWith('%output ')) {
      const spaceIdx = line.indexOf(' ', 8) // after "%output "
      if (spaceIdx === -1) return
      const paneId = line.substring(8, spaceIdx)
      const rawData = line.substring(spaceIdx + 1)
      const decoded = decodeOctalEscapes(rawData)
      this.emit('notification', {
        type: 'output',
        paneId,
        data: decoded
      } as TmuxNotification)
      return
    }

    // %window-add @ID
    if (line.startsWith('%window-add ')) {
      const windowId = line.substring(12).trim()
      this.emit('notification', {
        type: 'window-add',
        windowId
      } as TmuxNotification)
      return
    }

    // %window-close @ID
    if (line.startsWith('%window-close ')) {
      const windowId = line.substring(14).trim()
      this.emit('notification', {
        type: 'window-close',
        windowId
      } as TmuxNotification)
      return
    }

    // %window-renamed @ID NAME
    if (line.startsWith('%window-renamed ')) {
      const rest = line.substring(16)
      const spaceIdx = rest.indexOf(' ')
      if (spaceIdx === -1) return
      const windowId = rest.substring(0, spaceIdx)
      const name = rest.substring(spaceIdx + 1)
      this.emit('notification', {
        type: 'window-renamed',
        windowId,
        name
      } as TmuxNotification)
      return
    }

    // %layout-change @ID LAYOUT [FLAGS]
    if (line.startsWith('%layout-change ')) {
      const rest = line.substring(15)
      const parts = rest.split(' ')
      if (parts.length >= 2) {
        this.emit('notification', {
          type: 'layout-change',
          windowId: parts[0],
          layout: parts[1]
        } as TmuxNotification)
      }
      return
    }

    // %exit [REASON]
    if (line.startsWith('%exit')) {
      const reason = line.length > 6 ? line.substring(6).trim() : undefined
      this.exited = true
      this.emit('notification', {
        type: 'exit',
        reason
      } as TmuxNotification)
      return
    }

    // %session-changed, %pane-mode-changed, etc. — emit as generic notification
    if (line.startsWith('%session-changed ')) {
      this.emit('notification', { type: 'session-changed', data: line } as TmuxNotification)
      return
    }
  }

  reset(): void {
    this.buffer = ''
    this.inBlock = false
    this.blockSeq = -1
    this.blockLines = []
    this.blockIsError = false
  }
}
