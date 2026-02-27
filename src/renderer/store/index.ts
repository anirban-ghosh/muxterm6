import { create } from 'zustand'
import { createTabsSlice, type TabsSlice } from './tabs'
import { createPanesSlice, type PanesSlice } from './panes'
import { createTerminalsSlice, type TerminalsSlice } from './terminals'

export type AppStore = TabsSlice & PanesSlice & TerminalsSlice

export const useStore = create<AppStore>()((...a) => ({
  ...createTabsSlice(...a),
  ...createPanesSlice(...a),
  ...createTerminalsSlice(...a)
}))
