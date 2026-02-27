import React, { useCallback, useRef } from 'react'
import { Tab } from './Tab'

interface TabInfo {
  id: string
  title: string
}

interface TabBarProps {
  tabs: TabInfo[]
  activeTabId: string | null
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
  onReorder: (fromIndex: number, toIndex: number) => void
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onActivate,
  onClose,
  onNew,
  onReorder
}) => {
  const dragIndexRef = useRef<number | null>(null)

  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index
  }, [])

  const handleDragOver = useCallback(
    (index: number) => {
      if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
        onReorder(dragIndexRef.current, index)
        dragIndexRef.current = index
      }
    },
    [onReorder]
  )

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null
  }, [])

  return (
    <div className="tabbar">
      <div className="tabbar__tabs">
        {tabs.map((tab, index) => (
          <Tab
            key={tab.id}
            id={tab.id}
            title={tab.title}
            isActive={tab.id === activeTabId}
            onActivate={onActivate}
            onClose={onClose}
            index={index}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>
      <button className="tabbar__new" onClick={onNew} title="New Tab">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
