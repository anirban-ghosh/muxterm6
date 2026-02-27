import type { StateCreator } from 'zustand'
import type { Tab, SplitNode } from '../../shared/types'
import type { PanesSlice } from './panes'
import type { TerminalsSlice } from './terminals'

export interface TabsSlice {
  tabs: Tab[]
  activeTabId: string | null
  addTab: (tab: Tab) => void
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateTabTitle: (tabId: string, title: string) => void
  updateTabRoot: (tabId: string, rootNode: SplitNode) => void
  updateTabActivePane: (tabId: string, paneId: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
}

export const createTabsSlice: StateCreator<
  TabsSlice & PanesSlice & TerminalsSlice,
  [],
  [],
  TabsSlice
> = (set) => ({
  tabs: [],
  activeTabId: null,

  addTab: (tab) =>
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id
    })),

  removeTab: (tabId) =>
    set((state) => {
      const idx = state.tabs.findIndex((t) => t.id === tabId)
      const newTabs = state.tabs.filter((t) => t.id !== tabId)
      let newActiveId = state.activeTabId
      if (state.activeTabId === tabId) {
        if (newTabs.length > 0) {
          const newIdx = Math.min(idx, newTabs.length - 1)
          newActiveId = newTabs[newIdx].id
        } else {
          newActiveId = null
        }
      }
      return { tabs: newTabs, activeTabId: newActiveId }
    }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateTabTitle: (tabId, title) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, title } : t))
    })),

  updateTabRoot: (tabId, rootNode) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, rootNode } : t))
    })),

  updateTabActivePane: (tabId, paneId) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, activePaneId: paneId } : t))
    })),

  reorderTabs: (fromIndex, toIndex) =>
    set((state) => {
      const newTabs = [...state.tabs]
      const [moved] = newTabs.splice(fromIndex, 1)
      newTabs.splice(toIndex, 0, moved)
      return { tabs: newTabs }
    })
})
