import type { StateCreator } from 'zustand'
import type { TabsSlice } from './tabs'
import type { PanesSlice } from './panes'
import type { TerminalsSlice } from './terminals'

export interface TmuxSlice {
  isTmuxWindow: boolean
  tmuxSessionId: string | null
  tmuxSessionName: string | null
  tmuxTriggerPtyId: string | null
  tmuxActiveWindowId: string | null
  // Map from tmux window ID to tab ID
  tmuxWindowToTab: Record<string, string>
  // Map from tmux pane ID to local pane ID
  tmuxPaneToLocal: Record<string, string>
  // Scrollback data for each tmux pane (consumed on mount)
  tmuxScrollback: Record<string, string>

  setTmuxMode: (sessionId: string, sessionName: string, triggerPtyId: string) => void
  setTmuxTrigger: (ptyId: string, sessionName: string) => void
  clearTmuxTrigger: () => void
  setTmuxActiveWindow: (windowId: string) => void
  addTmuxWindowMapping: (tmuxWindowId: string, tabId: string) => void
  removeTmuxWindowMapping: (tmuxWindowId: string) => void
  addTmuxPaneMapping: (tmuxPaneId: string, localPaneId: string) => void
  removeTmuxPaneMapping: (tmuxPaneId: string) => void
  setTmuxScrollback: (scrollback: Record<string, string>) => void
  consumeTmuxScrollback: (tmuxPaneId: string) => string | undefined
  clearTmuxMode: () => void
}

export const createTmuxSlice: StateCreator<
  TabsSlice & PanesSlice & TerminalsSlice & TmuxSlice,
  [],
  [],
  TmuxSlice
> = (set, get) => ({
  isTmuxWindow: false,
  tmuxSessionId: null,
  tmuxSessionName: null,
  tmuxTriggerPtyId: null,
  tmuxActiveWindowId: null,
  tmuxWindowToTab: {},
  tmuxPaneToLocal: {},
  tmuxScrollback: {},

  setTmuxMode: (sessionId, sessionName, triggerPtyId) =>
    set({
      isTmuxWindow: true,
      tmuxSessionId: sessionId,
      tmuxSessionName: sessionName,
      tmuxTriggerPtyId: triggerPtyId
    }),

  setTmuxTrigger: (ptyId, sessionName) =>
    set({ tmuxTriggerPtyId: ptyId, tmuxSessionName: sessionName }),

  clearTmuxTrigger: () =>
    set({ tmuxTriggerPtyId: null, tmuxSessionName: null }),

  setTmuxActiveWindow: (windowId) =>
    set({ tmuxActiveWindowId: windowId }),

  addTmuxWindowMapping: (tmuxWindowId, tabId) =>
    set((state) => ({
      tmuxWindowToTab: { ...state.tmuxWindowToTab, [tmuxWindowId]: tabId }
    })),

  removeTmuxWindowMapping: (tmuxWindowId) =>
    set((state) => {
      const { [tmuxWindowId]: _, ...rest } = state.tmuxWindowToTab
      return { tmuxWindowToTab: rest }
    }),

  addTmuxPaneMapping: (tmuxPaneId, localPaneId) =>
    set((state) => ({
      tmuxPaneToLocal: { ...state.tmuxPaneToLocal, [tmuxPaneId]: localPaneId }
    })),

  removeTmuxPaneMapping: (tmuxPaneId) =>
    set((state) => {
      const { [tmuxPaneId]: _, ...rest } = state.tmuxPaneToLocal
      return { tmuxPaneToLocal: rest }
    }),

  setTmuxScrollback: (scrollback) =>
    set({ tmuxScrollback: scrollback }),

  consumeTmuxScrollback: (tmuxPaneId) => {
    const data = get().tmuxScrollback[tmuxPaneId]
    if (data) {
      const { [tmuxPaneId]: _, ...rest } = get().tmuxScrollback
      set({ tmuxScrollback: rest })
    }
    return data
  },

  clearTmuxMode: () =>
    set({
      isTmuxWindow: false,
      tmuxSessionId: null,
      tmuxSessionName: null,
      tmuxTriggerPtyId: null,
      tmuxActiveWindowId: null,
      tmuxWindowToTab: {},
      tmuxPaneToLocal: {},
      tmuxScrollback: {}
    })
})
