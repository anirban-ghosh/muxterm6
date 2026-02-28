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
  isTmux?: boolean
  onTmuxResize?: (tmuxPaneId: string, direction: 'x' | 'y', amount: number) => void
}

export const SplitContainer: React.FC<SplitContainerProps> = ({
  node,
  tabId,
  activePaneId,
  onPaneFocus,
  onResize,
  isTmux,
  onTmuxResize
}) => {
  if (node.type === 'leaf') {
    return (
      <TerminalView
        paneId={node.paneId}
        ptyId={node.ptyId}
        isActive={node.paneId === activePaneId}
        onFocus={() => onPaneFocus(node.paneId)}
        tmuxPaneId={node.tmuxPaneId}
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

  // For tmux resize, get the tmux pane ID of the second child's first leaf
  const getFirstTmuxPaneId = (n: SplitNode): string | undefined => {
    if (n.type === 'leaf') return n.tmuxPaneId
    return getFirstTmuxPaneId(n.first)
  }

  const handleTmuxDividerResize = isTmux && onTmuxResize
    ? (delta: number) => {
        const tmuxPaneId = getFirstTmuxPaneId(node.second)
        if (tmuxPaneId) {
          const dir = node.direction === 'vertical' ? 'x' as const : 'y' as const
          onTmuxResize(tmuxPaneId, dir, delta)
        }
      }
    : undefined

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
          isTmux={isTmux}
          onTmuxResize={onTmuxResize}
        />
      </div>
      <SplitDivider
        direction={node.direction}
        onResize={(ratio) => onResize(resizeId, ratio)}
        isTmux={isTmux}
        onTmuxDividerResize={handleTmuxDividerResize}
      />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <SplitContainer
          node={node.second}
          tabId={tabId}
          activePaneId={activePaneId}
          onPaneFocus={onPaneFocus}
          onResize={onResize}
          isTmux={isTmux}
          onTmuxResize={onTmuxResize}
        />
      </div>
    </div>
  )
}
