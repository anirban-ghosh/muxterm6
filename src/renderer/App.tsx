import React, { useEffect, useCallback, useRef } from 'react'
import { useStore } from './store'
import { collectPtyIds } from './store/panes'
import { TitleBar } from './components/TitleBar/TitleBar'
import { TabBar } from './components/TabBar/TabBar'
import { SplitContainer } from './components/SplitPane/SplitContainer'
import { StatusBar } from './components/StatusBar/StatusBar'
import type { Tab } from '../shared/types'

let tabCounter = 0
let paneCounter = 0

function generateTabId(): string {
  return `tab-${++tabCounter}`
}

function generatePaneId(): string {
  return `pane-${++paneCounter}`
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
  const setTerminal = useStore((s) => s.setTerminal)
  const removeTerminal = useStore((s) => s.removeTerminal)
  const splitPane = useStore((s) => s.splitPane)
  const closePane = useStore((s) => s.closePane)
  const resizePane = useStore((s) => s.resizePane)

  const createNewTab = useCallback(async () => {
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
  }, [addTab, setTerminal])

  const handleCloseTab = useCallback(
    (tabId: string) => {
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
    [removeTab, removeTerminal]
  )

  const handleSplit = useCallback(
    async (direction: 'horizontal' | 'vertical') => {
      const state = useStore.getState()
      const tab = state.tabs.find((t) => t.id === state.activeTabId)
      if (!tab) return

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

  // Listen for pty exit events to auto-close panes/tabs
  useEffect(() => {
    const off = window.terminalAPI.onPtyExit((ptyId, _exitCode) => {
      removeTerminal(ptyId)
      const state = useStore.getState()
      for (const tab of state.tabs) {
        if (tab.rootNode.type === 'leaf' && tab.rootNode.ptyId === ptyId) {
          // Single pane tab — remove the tab
          removeTab(tab.id)
          if (useStore.getState().tabs.length === 0) {
            window.close()
          }
          return
        }
        // Multi-pane tab — find and close the pane
        const paneId = findPaneByPty(tab.rootNode, ptyId)
        if (paneId) {
          closePane(tab.id, paneId)
          return
        }
      }
    })
    return off
  }, [removeTerminal, removeTab, closePane])

  // Create initial tab
  useEffect(() => {
    createNewTab()
  }, []) // only on mount

  // Menu event listeners
  useEffect(() => {
    const offNew = window.terminalAPI.onMenuNewTab(() => createNewTab())
    const offClose = window.terminalAPI.onMenuCloseTab(() => {
      const state = useStore.getState()
      if (state.activeTabId) handleCloseTab(state.activeTabId)
    })
    const offSplitV = window.terminalAPI.onMenuSplitVertical(() => handleSplit('vertical'))
    const offSplitH = window.terminalAPI.onMenuSplitHorizontal(() => handleSplit('horizontal'))
    return () => {
      offNew()
      offClose()
      offSplitV()
      offSplitH()
    }
  }, [createNewTab, handleCloseTab, handleSplit])

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
      <div className="app__content">
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
            />
          </div>
        ))}
      </div>
      <StatusBar />
    </div>
  )
}

import type { SplitNode } from '../shared/types'

function findPaneByPty(node: SplitNode, ptyId: string): string | null {
  if (node.type === 'leaf') {
    return node.ptyId === ptyId ? node.paneId : null
  }
  return findPaneByPty(node.first, ptyId) || findPaneByPty(node.second, ptyId)
}
