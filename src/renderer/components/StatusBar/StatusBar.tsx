import React from 'react'
import { useStore } from '../../store'
import { findPtyForPane } from '../../store/panes'

export const StatusBar: React.FC = () => {
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)
  const terminals = useStore((s) => s.terminals)

  const activeTab = tabs.find((t) => t.id === activeTabId)
  if (!activeTab) return <div className="statusbar" />

  const ptyId = findPtyForPane(activeTab.rootNode, activeTab.activePaneId)
  const meta = ptyId ? terminals[ptyId] : null

  return (
    <div className="statusbar">
      <span className="statusbar__shell">{meta?.shell ?? 'shell'}</span>
      <span className="statusbar__spacer" />
      <span className="statusbar__size">
        {meta ? `${meta.cols} x ${meta.rows}` : ''}
      </span>
    </div>
  )
}
