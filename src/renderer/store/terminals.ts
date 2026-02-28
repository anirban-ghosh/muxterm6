import type { StateCreator } from 'zustand'
import type { TerminalMeta } from '../../shared/types'
import type { TabsSlice } from './tabs'
import type { PanesSlice } from './panes'
import type { TmuxSlice } from './tmux'

export interface TerminalsSlice {
  terminals: Record<string, TerminalMeta>
  setTerminal: (ptyId: string, meta: TerminalMeta) => void
  removeTerminal: (ptyId: string) => void
  updateTerminalSize: (ptyId: string, cols: number, rows: number) => void
}

export const createTerminalsSlice: StateCreator<
  TabsSlice & PanesSlice & TerminalsSlice & TmuxSlice,
  [],
  [],
  TerminalsSlice
> = (set) => ({
  terminals: {},

  setTerminal: (ptyId, meta) =>
    set((state) => ({
      terminals: { ...state.terminals, [ptyId]: meta }
    })),

  removeTerminal: (ptyId) =>
    set((state) => {
      const { [ptyId]: _, ...rest } = state.terminals
      return { terminals: rest }
    }),

  updateTerminalSize: (ptyId, cols, rows) =>
    set((state) => ({
      terminals: {
        ...state.terminals,
        [ptyId]: { ...state.terminals[ptyId], cols, rows }
      }
    }))
})
