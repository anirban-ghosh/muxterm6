import type { PtyCreateResult } from '../shared/types'

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
  newWindow(): void
}

declare global {
  interface Window {
    terminalAPI: TerminalAPI
  }
}
