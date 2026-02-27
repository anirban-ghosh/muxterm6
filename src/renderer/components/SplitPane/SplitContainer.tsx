import React, { useCallback } from 'react'
import type { SplitNode } from '../../../shared/types'
import { TerminalView } from '../Terminal/TerminalView'
import { SplitDivider } from './SplitDivider'

interface SplitContainerProps {
  node: SplitNode
  tabId: string
  activePaneId: string
  onPaneFocus: (paneId: string) => void
  onResize: (paneId: string, ratio: number) => void
}

export const SplitContainer: React.FC<SplitContainerProps> = ({
  node,
  tabId,
  activePaneId,
  onPaneFocus,
  onResize
}) => {
  if (node.type === 'leaf') {
    return (
      <TerminalView
        paneId={node.paneId}
        ptyId={node.ptyId}
        isActive={node.paneId === activePaneId}
        onFocus={() => onPaneFocus(node.paneId)}
      />
    )
  }

  const isVertical = node.direction === 'vertical'
  const firstSize = `${node.ratio * 100}%`
  const secondSize = `${(1 - node.ratio) * 100}%`

  // For resize, we use the first child's paneId as the identifier
  const getFirstLeafId = (n: SplitNode): string => {
    if (n.type === 'leaf') return n.paneId
    return getFirstLeafId(n.first)
  }
  const resizeId = getFirstLeafId(node.first)

  return (
    <div
      className="split-container"
      style={{
        display: 'flex',
        flexDirection: isVertical ? 'row' : 'column',
        width: '100%',
        height: '100%'
      }}
    >
      <div style={{ [isVertical ? 'width' : 'height']: firstSize, overflow: 'hidden' }}>
        <SplitContainer
          node={node.first}
          tabId={tabId}
          activePaneId={activePaneId}
          onPaneFocus={onPaneFocus}
          onResize={onResize}
        />
      </div>
      <SplitDivider
        direction={node.direction}
        onResize={(ratio) => onResize(resizeId, ratio)}
      />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <SplitContainer
          node={node.second}
          tabId={tabId}
          activePaneId={activePaneId}
          onPaneFocus={onPaneFocus}
          onResize={onResize}
        />
      </div>
    </div>
  )
}
