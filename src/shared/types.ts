export type SplitDirection = 'horizontal' | 'vertical'

export type SplitNode =
  | { type: 'leaf'; paneId: string; ptyId: string; tmuxPaneId?: string }
  | {
      type: 'split'
      direction: SplitDirection
      ratio: number
      first: SplitNode
      second: SplitNode
    }

export interface Tab {
  id: string
  title: string
  rootNode: SplitNode
  activePaneId: string
}

export interface TerminalMeta {
  ptyId: string
  pid: number
  shell: string
  cols: number
  rows: number
}

export interface PtyCreateResult {
  ptyId: string
  pid: number
  shell: string
}
