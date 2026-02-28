import type { PtyCreateResult, SplitNode } from '../shared/types'
import type { TmuxSessionInfo, TmuxWindowInfo } from '../shared/tmux-types'

export interface TerminalAPI {
  createPty(cols?: number, rows?: number): Promise<PtyCreateResult>
  destroyPty(ptyId: string): Promise<void>
  resizePty(ptyId: string, cols: number, rows: number): Promise<void>
  writePty(ptyId: string, data: string): void
  onPtyOutput(callback: (ptyId: string, data: string) => void): () => void
  onPtyExit(callback: (ptyId: string, exitCode: number) => void): () => void
  onPtyTitle(callback: (ptyId: string, title: string) => void): () => void
  onMenuNewTab(callback: () => void): () => void
  onMenuCloseTab(callback: () => void): () => void
  onMenuSplitVertical(callback: () => void): () => void
  onMenuSplitHorizontal(callback: () => void): () => void
  onMenuNextTab(callback: () => void): () => void
  onMenuPrevTab(callback: () => void): () => void
  newWindow(): void

  // Tmux control mode API
  writeTmuxPane(tmuxPaneId: string, data: string): void
  resizeTmux(cols: number, rows: number): void
  tmuxPaneResized(tmuxPaneId: string, cols: number, rows: number): void
  tmuxNewWindow(): void
  tmuxSplitPane(tmuxPaneId: string, direction: 'horizontal' | 'vertical'): void
  tmuxKillPane(tmuxPaneId: string): void
  tmuxResizePane(tmuxPaneId: string, direction: 'x' | 'y', amount: number): void
  tmuxDetach(ptyId: string): void
  tmuxForceQuit(ptyId: string): void

  onTmuxDetected(callback: (ptyId: string, sessionName: string) => void): () => void
  onTmuxSessionReady(callback: (info: TmuxSessionInfo) => void): () => void
  onTmuxOutput(callback: (tmuxPaneId: string, data: string) => void): () => void
  onTmuxScrollback(callback: (tmuxPaneId: string, data: string) => void): () => void
  onTmuxTabAdd(callback: (info: TmuxWindowInfo) => void): () => void
  onTmuxTabClose(callback: (windowId: string) => void): () => void
  onTmuxTabRenamed(callback: (windowId: string, name: string) => void): () => void
  onTmuxLayoutChange(callback: (windowId: string, rootNode: SplitNode) => void): () => void
  onTmuxExit(callback: (ptyId?: string) => void): () => void
}

declare global {
  interface Window {
    terminalAPI: TerminalAPI
  }
}
