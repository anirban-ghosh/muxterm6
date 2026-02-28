import React, { useEffect, useCallback, useRef } from 'react'
import { useStore } from './store'
import { collectPtyIds } from './store/panes'
import { TitleBar } from './components/TitleBar/TitleBar'
import { TabBar } from './components/TabBar/TabBar'
import { SplitContainer } from './components/SplitPane/SplitContainer'
import { StatusBar } from './components/StatusBar/StatusBar'
import { TmuxGatewayView } from './components/Terminal/TmuxGatewayView'
import type { Tab, SplitNode } from '../shared/types'
import type { TmuxSessionInfo, TmuxWindowInfo } from '../shared/tmux-types'

let tabCounter = 0
let paneCounter = 0

function generateTabId(): string {
  return `tab-${++tabCounter}`
}

function generatePaneId(): string {
  return `pane-${++paneCounter}`
}

// Detect if this window was opened as a tmux window via URL param
function getTmuxSessionId(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('tmux')
}

export default function App() {
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)
  const addTab = useStore((s) => s.addTab)
  const removeTab = useStore((s) => s.removeTab)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const reorderTabs = useStore((s) => s.reorderTabs)
  const updateTabTitle = useStore((s) => s.updateTabTitle)
  const updateTabActivePane = useStore((s) => s.updateTabActivePane)
  const updateTabRoot = useStore((s) => s.updateTabRoot)
  const setTerminal = useStore((s) => s.setTerminal)
  const removeTerminal = useStore((s) => s.removeTerminal)
  const splitPane = useStore((s) => s.splitPane)
  const closePane = useStore((s) => s.closePane)
  const resizePane = useStore((s) => s.resizePane)

  // Tmux state
  const isTmuxWindow = useStore((s) => s.isTmuxWindow)
  const tmuxTriggerPtyId = useStore((s) => s.tmuxTriggerPtyId)
  const tmuxSessionName = useStore((s) => s.tmuxSessionName)
  const setTmuxMode = useStore((s) => s.setTmuxMode)
  const setTmuxTrigger = useStore((s) => s.setTmuxTrigger)
  const clearTmuxTrigger = useStore((s) => s.clearTmuxTrigger)
  const clearTmuxMode = useStore((s) => s.clearTmuxMode)
  const addTmuxWindowMapping = useStore((s) => s.addTmuxWindowMapping)
  const removeTmuxWindowMapping = useStore((s) => s.removeTmuxWindowMapping)
  const setTmuxActiveWindow = useStore((s) => s.setTmuxActiveWindow)
  const setTmuxScrollback = useStore((s) => s.setTmuxScrollback)

  const tmuxSessionIdRef = useRef<string | null>(null)
  const mountedRef = useRef(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const createNewTab = useCallback(async () => {
    if (isTmuxWindow) {
      // In tmux window, new tab = new tmux window
      window.terminalAPI.tmuxNewWindow()
      return
    }

    const tabId = generateTabId()
    const paneId = generatePaneId()

    const result = await window.terminalAPI.createPty()

    const tab: Tab = {
      id: tabId,
      title: result.shell.split('/').pop() || 'shell',
      rootNode: { type: 'leaf', paneId, ptyId: result.ptyId },
      activePaneId: paneId
    }

    setTerminal(result.ptyId, {
      ptyId: result.ptyId,
      pid: result.pid,
      shell: result.shell,
      cols: 80,
      rows: 24
    })

    addTab(tab)
  }, [addTab, setTerminal, isTmuxWindow])

  const handleCloseTab = useCallback(
    (tabId: string) => {
      if (isTmuxWindow) {
        // In tmux window, find the tmux pane and kill it
        const tab = useStore.getState().tabs.find((t) => t.id === tabId)
        if (tab && tab.rootNode.type === 'leaf' && tab.rootNode.tmuxPaneId) {
          window.terminalAPI.tmuxKillPane(tab.rootNode.tmuxPaneId)
        }
        return
      }

      const tab = useStore.getState().tabs.find((t) => t.id === tabId)
      if (tab) {
        const ptyIds = collectPtyIds(tab.rootNode)
        ptyIds.forEach((id) => {
          window.terminalAPI.destroyPty(id)
          removeTerminal(id)
        })
      }
      removeTab(tabId)

      // Close window if no tabs left
      if (useStore.getState().tabs.length === 0) {
        window.close()
      }
    },
    [removeTab, removeTerminal, isTmuxWindow]
  )

  const handleSplit = useCallback(
    async (direction: 'horizontal' | 'vertical') => {
      const state = useStore.getState()
      const tab = state.tabs.find((t) => t.id === state.activeTabId)
      if (!tab) return

      if (state.isTmuxWindow) {
        // In tmux window, find the active pane's tmux pane ID and split via tmux
        const activeTmuxPaneId = findTmuxPaneId(tab.rootNode, tab.activePaneId)
        if (activeTmuxPaneId) {
          window.terminalAPI.tmuxSplitPane(activeTmuxPaneId, direction)
        }
        return
      }

      const newPaneId = generatePaneId()
      const result = await window.terminalAPI.createPty()

      setTerminal(result.ptyId, {
        ptyId: result.ptyId,
        pid: result.pid,
        shell: result.shell,
        cols: 80,
        rows: 24
      })

      splitPane(tab.id, tab.activePaneId, direction, newPaneId, result.ptyId)
    },
    [splitPane, setTerminal]
  )

  const handlePaneFocus = useCallback(
    (paneId: string) => {
      if (activeTabId) {
        updateTabActivePane(activeTabId, paneId)
      }
    },
    [activeTabId, updateTabActivePane]
  )

  const handlePaneResize = useCallback(
    (paneId: string, ratio: number) => {
      if (activeTabId) {
        resizePane(activeTabId, paneId, ratio)
      }
    },
    [activeTabId, resizePane]
  )

  const handleTmuxPaneResize = useCallback(
    (tmuxPaneId: string, direction: 'x' | 'y', amount: number) => {
      window.terminalAPI.tmuxResizePane(tmuxPaneId, direction, amount)
    },
    []
  )

  const handleDetach = useCallback(() => {
    const ptyId = useStore.getState().tmuxTriggerPtyId
    if (ptyId) {
      window.terminalAPI.tmuxDetach(ptyId)
      clearTmuxTrigger()
    }
  }, [clearTmuxTrigger])

  const handleForceQuit = useCallback(() => {
    const ptyId = useStore.getState().tmuxTriggerPtyId
    if (ptyId) {
      window.terminalAPI.tmuxForceQuit(ptyId)
      clearTmuxTrigger()
    }
  }, [clearTmuxTrigger])

  // Listen for pty exit events to auto-close panes/tabs (normal mode only)
  useEffect(() => {
    const off = window.terminalAPI.onPtyExit((ptyId, _exitCode) => {
      removeTerminal(ptyId)
      const state = useStore.getState()

      // If this PTY was a tmux trigger, clear the gateway
      if (state.tmuxTriggerPtyId === ptyId) {
        clearTmuxTrigger()
      }

      if (state.isTmuxWindow) return // Tmux window pane lifecycle handled by tmux notifications

      for (const tab of state.tabs) {
        if (tab.rootNode.type === 'leaf' && tab.rootNode.ptyId === ptyId) {
          removeTab(tab.id)
          if (useStore.getState().tabs.length === 0) {
            window.close()
          }
          return
        }
        const paneId = findPaneByPty(tab.rootNode, ptyId)
        if (paneId) {
          closePane(tab.id, paneId)
          return
        }
      }
    })
    return off
  }, [removeTerminal, removeTab, closePane, clearTmuxTrigger])

  // Detect tmux window mode on mount
  useEffect(() => {
    if (mountedRef.current) return // Guard against StrictMode double-mount
    mountedRef.current = true

    const sessionId = getTmuxSessionId()
    if (sessionId) {
      tmuxSessionIdRef.current = sessionId
      // Don't create an initial tab — wait for session-ready
    } else {
      // Normal window — create initial tab
      createNewTab()
    }
  }, []) // only on mount

  // Tmux window: listen for session-ready and notifications
  useEffect(() => {
    const sessionId = getTmuxSessionId()
    if (!sessionId) return

    const offReady = window.terminalAPI.onTmuxSessionReady((info: TmuxSessionInfo) => {
      setTmuxMode(info.sessionId, info.sessionName, info.triggerPtyId)

      // Store scrollback data for TerminalViews to consume on mount
      if (info.scrollback) {
        setTmuxScrollback(info.scrollback)
      }

      // Build tabs from tmux windows
      for (const win of info.windows) {
        const tabId = generateTabId()
        addTmuxWindowMapping(win.windowId, tabId)

        const rootNode = win.rootNode || {
          type: 'leaf' as const,
          paneId: generatePaneId(),
          ptyId: '',
          tmuxPaneId: win.panes[0]?.paneId
        }

        const activePaneId = getFirstLeafPaneId(rootNode)

        const tab: Tab = {
          id: tabId,
          title: win.name,
          rootNode,
          activePaneId
        }

        addTab(tab)
        if (win.active) {
          setActiveTab(tabId)
          setTmuxActiveWindow(win.windowId)
        }
      }
    })

    const offTabAdd = window.terminalAPI.onTmuxTabAdd((info: TmuxWindowInfo) => {
      const tabId = generateTabId()
      addTmuxWindowMapping(info.windowId, tabId)

      const rootNode = info.rootNode || {
        type: 'leaf' as const,
        paneId: generatePaneId(),
        ptyId: '',
        tmuxPaneId: info.panes[0]?.paneId
      }

      const tab: Tab = {
        id: tabId,
        title: info.name,
        rootNode,
        activePaneId: getFirstLeafPaneId(rootNode)
      }

      addTab(tab)
      setActiveTab(tabId)
      setTmuxActiveWindow(info.windowId)
    })

    const offTabClose = window.terminalAPI.onTmuxTabClose((windowId: string) => {
      const state = useStore.getState()
      const tabId = state.tmuxWindowToTab[windowId]
      if (tabId) {
        removeTab(tabId)
        removeTmuxWindowMapping(windowId)
        if (useStore.getState().tabs.length === 0) {
          window.close()
        }
      }
    })

    const offTabRenamed = window.terminalAPI.onTmuxTabRenamed((windowId: string, name: string) => {
      const state = useStore.getState()
      const tabId = state.tmuxWindowToTab[windowId]
      if (tabId) {
        updateTabTitle(tabId, name)
      }
    })

    const offLayoutChange = window.terminalAPI.onTmuxLayoutChange(
      (windowId: string, newRootNode: SplitNode) => {
        const state = useStore.getState()
        const tabId = state.tmuxWindowToTab[windowId]
        if (tabId) {
          const tab = state.tabs.find((t) => t.id === tabId)
          const merged = tab ? mergeLayoutTree(tab.rootNode, newRootNode) : newRootNode
          updateTabRoot(tabId, merged)
        }
      }
    )

    const offExit = window.terminalAPI.onTmuxExit(() => {
      clearTmuxMode()
      window.close()
    })

    return () => {
      offReady()
      offTabAdd()
      offTabClose()
      offTabRenamed()
      offLayoutChange()
      offExit()
    }
  }, [])

  // Normal window: listen for tmux detected (gateway overlay)
  useEffect(() => {
    if (getTmuxSessionId()) return // Don't listen in tmux windows

    const off = window.terminalAPI.onTmuxDetected((ptyId, sessionName) => {
      setTmuxTrigger(ptyId, sessionName)
    })

    const offExit = window.terminalAPI.onTmuxExit((ptyId) => {
      const state = useStore.getState()
      if (ptyId && state.tmuxTriggerPtyId === ptyId) {
        clearTmuxTrigger()
      }
    })

    return () => {
      off()
      offExit()
    }
  }, [setTmuxTrigger, clearTmuxTrigger])

  // Tmux client resize is now handled by TerminalView reporting actual pane
  // dimensions (via tmuxPaneResized IPC). TmuxSession computes the total client
  // size from the layout tree + reported pane sizes and calls refresh-client.

  // Menu event listeners
  useEffect(() => {
    const offNew = window.terminalAPI.onMenuNewTab(() => createNewTab())
    const offClose = window.terminalAPI.onMenuCloseTab(() => {
      const state = useStore.getState()
      if (state.activeTabId) handleCloseTab(state.activeTabId)
    })
    const offSplitV = window.terminalAPI.onMenuSplitVertical(() => handleSplit('vertical'))
    const offSplitH = window.terminalAPI.onMenuSplitHorizontal(() => handleSplit('horizontal'))
    const offNextTab = window.terminalAPI.onMenuNextTab(() => {
      const { tabs, activeTabId, setActiveTab } = useStore.getState()
      if (tabs.length < 2) return
      const idx = tabs.findIndex((t) => t.id === activeTabId)
      const nextIdx = (idx + 1) % tabs.length
      setActiveTab(tabs[nextIdx].id)
    })
    const offPrevTab = window.terminalAPI.onMenuPrevTab(() => {
      const { tabs, activeTabId, setActiveTab } = useStore.getState()
      if (tabs.length < 2) return
      const idx = tabs.findIndex((t) => t.id === activeTabId)
      const prevIdx = (idx - 1 + tabs.length) % tabs.length
      setActiveTab(tabs[prevIdx].id)
    })
    return () => {
      offNew()
      offClose()
      offSplitV()
      offSplitH()
      offNextTab()
      offPrevTab()
    }
  }, [createNewTab, handleCloseTab, handleSplit])

  // Find the active tab to check for gateway overlay
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const showGateway =
    !isTmuxWindow &&
    tmuxTriggerPtyId &&
    activeTab &&
    hasMatchingPty(activeTab.rootNode, tmuxTriggerPtyId)

  return (
    <div className="app">
      <TitleBar>
        <TabBar
          tabs={tabs.map((t) => ({ id: t.id, title: t.title }))}
          activeTabId={activeTabId}
          onActivate={setActiveTab}
          onClose={handleCloseTab}
          onNew={createNewTab}
          onReorder={reorderTabs}
        />
      </TitleBar>
      <div className="app__content" ref={contentRef}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="app__tab-content"
            style={{ display: tab.id === activeTabId ? 'flex' : 'none' }}
          >
            <SplitContainer
              node={tab.rootNode}
              tabId={tab.id}
              activePaneId={tab.activePaneId}
              onPaneFocus={handlePaneFocus}
              onResize={handlePaneResize}
              isTmux={isTmuxWindow}
              onTmuxResize={isTmuxWindow ? handleTmuxPaneResize : undefined}
            />
          </div>
        ))}
        {showGateway && tmuxTriggerPtyId && tmuxSessionName && (
          <TmuxGatewayView
            ptyId={tmuxTriggerPtyId}
            sessionName={tmuxSessionName}
            onDetach={handleDetach}
            onForceQuit={handleForceQuit}
          />
        )}
      </div>
      <StatusBar />
    </div>
  )
}

function findPaneByPty(node: SplitNode, ptyId: string): string | null {
  if (node.type === 'leaf') {
    return node.ptyId === ptyId ? node.paneId : null
  }
  return findPaneByPty(node.first, ptyId) || findPaneByPty(node.second, ptyId)
}

function findTmuxPaneId(node: SplitNode, paneId: string): string | undefined {
  if (node.type === 'leaf') {
    return node.paneId === paneId ? node.tmuxPaneId : undefined
  }
  return findTmuxPaneId(node.first, paneId) || findTmuxPaneId(node.second, paneId)
}

function getFirstLeafPaneId(node: SplitNode): string {
  if (node.type === 'leaf') return node.paneId
  return getFirstLeafPaneId(node.first)
}

function hasMatchingPty(node: SplitNode, ptyId: string): boolean {
  if (node.type === 'leaf') return node.ptyId === ptyId
  return hasMatchingPty(node.first, ptyId) || hasMatchingPty(node.second, ptyId)
}

/**
 * Merge a new SplitNode tree with an existing one, preserving leaf `paneId` values
 * where `tmuxPaneId` matches. This prevents React from remounting TerminalViews
 * (and losing xterm state) when tmux sends layout-change notifications.
 */
function mergeLayoutTree(oldTree: SplitNode, newTree: SplitNode): SplitNode {
  // Collect existing paneId mappings keyed by tmuxPaneId
  const existingLeaves = new Map<string, string>()
  collectTmuxLeaves(oldTree, existingLeaves)
  return applyExistingPaneIds(newTree, existingLeaves)
}

function collectTmuxLeaves(node: SplitNode, map: Map<string, string>): void {
  if (node.type === 'leaf') {
    if (node.tmuxPaneId) map.set(node.tmuxPaneId, node.paneId)
  } else {
    collectTmuxLeaves(node.first, map)
    collectTmuxLeaves(node.second, map)
  }
}

function applyExistingPaneIds(node: SplitNode, map: Map<string, string>): SplitNode {
  if (node.type === 'leaf') {
    const existingPaneId = node.tmuxPaneId ? map.get(node.tmuxPaneId) : undefined
    if (existingPaneId) {
      return { ...node, paneId: existingPaneId }
    }
    return node
  }
  return {
    ...node,
    first: applyExistingPaneIds(node.first, map),
    second: applyExistingPaneIds(node.second, map)
  }
}
