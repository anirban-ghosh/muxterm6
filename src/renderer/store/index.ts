import { create } from 'zustand'
import { createTabsSlice, type TabsSlice } from './tabs'
import { createPanesSlice, type PanesSlice } from './panes'
import { createTerminalsSlice, type TerminalsSlice } from './terminals'
import { createTmuxSlice, type TmuxSlice } from './tmux'

export type AppStore = TabsSlice & PanesSlice & TerminalsSlice & TmuxSlice

export const useStore = create<AppStore>()((...a) => ({
  ...createTabsSlice(...a),
  ...createPanesSlice(...a),
  ...createTerminalsSlice(...a),
  ...createTmuxSlice(...a)
}))
