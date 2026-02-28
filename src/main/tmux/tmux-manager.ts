/**
 * Singleton registry of active TmuxSession instances keyed by control PTY ID.
 */

import { BrowserWindow } from 'electron'
import { TmuxSession } from './tmux-session'
import { windowManager } from '../window-manager'
import { ptyManager } from '../pty-manager'
import logger from '../logger'

class TmuxManager {
  private sessions = new Map<string, TmuxSession>()

  /**
   * Start a new tmux control mode session.
   * Called when DCS \033P1000p is detected in PTY output.
   */
  startSession(ptyId: string, triggerWindow: BrowserWindow): TmuxSession {
    logger.info({ ptyId }, 'starting tmux control mode session')

    const writeFn = (data: string) => ptyManager.write(ptyId, data)

    const session = new TmuxSession(
      ptyId,
      triggerWindow,
      writeFn,
      (sessionId: string) => windowManager.createTmuxWindow(sessionId)
    )

    session.onExit = () => {
      this.sessions.delete(ptyId)
      ptyManager.clearTmuxMode(ptyId)
      logger.info({ ptyId }, 'tmux session ended via %exit')
    }

    this.sessions.set(ptyId, session)
    return session
  }

  /**
   * Get the session for a given control PTY ID.
   */
  getSession(ptyId: string): TmuxSession | undefined {
    return this.sessions.get(ptyId)
  }

  /**
   * Get session by session ID.
   */
  getSessionById(sessionId: string): TmuxSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.id === sessionId) return session
    }
    return undefined
  }

  /**
   * Remove and dispose a session.
   */
  removeSession(ptyId: string): void {
    const session = this.sessions.get(ptyId)
    if (session) {
      session.dispose()
      this.sessions.delete(ptyId)
      ptyManager.clearTmuxMode(ptyId)
      logger.info({ ptyId }, 'tmux session removed')
    }
  }

  /**
   * Check if a PTY is running in tmux control mode.
   */
  hasSession(ptyId: string): boolean {
    return this.sessions.has(ptyId)
  }

  /**
   * Dispose all sessions.
   */
  disposeAll(): void {
    for (const [ptyId, session] of this.sessions) {
      session.dispose()
      this.sessions.delete(ptyId)
    }
  }
}

export const tmuxManager = new TmuxManager()
