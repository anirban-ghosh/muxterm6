import type { SplitNode } from './types'

export interface TmuxPaneInfo {
  paneId: string // e.g. '%0'
  width: number
  height: number
  active: boolean
}

export interface TmuxWindowInfo {
  windowId: string // e.g. '@0'
  name: string
  layout: string
  active: boolean
  panes: TmuxPaneInfo[]
  rootNode?: SplitNode
}

export interface TmuxSessionInfo {
  sessionId: string
  sessionName: string
  triggerPtyId: string
  windows: TmuxWindowInfo[]
  scrollback: Record<string, string> // tmuxPaneId -> scrollback data
}

// Protocol notification types
export interface TmuxOutputNotification {
  paneId: string
  data: string
}

export interface TmuxLayoutChangeNotification {
  windowId: string
  layout: string
}

export interface TmuxWindowAddNotification {
  windowId: string
}

export interface TmuxWindowCloseNotification {
  windowId: string
}

export interface TmuxWindowRenamedNotification {
  windowId: string
  name: string
}

// Command response
export interface TmuxCommandResponse {
  seqNumber: number
  success: boolean
  lines: string[]
}
