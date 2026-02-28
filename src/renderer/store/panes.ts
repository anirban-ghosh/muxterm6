import type { StateCreator } from 'zustand'
import type { SplitNode, SplitDirection } from '../../shared/types'
import type { TabsSlice } from './tabs'
import type { TerminalsSlice } from './terminals'
import type { TmuxSlice } from './tmux'

export interface PanesSlice {
  splitPane: (tabId: string, paneId: string, direction: SplitDirection, newPaneId: string, newPtyId: string) => void
  closePane: (tabId: string, paneId: string) => void
  resizePane: (tabId: string, paneId: string, ratio: number) => void
}

function splitNode(
  node: SplitNode,
  targetPaneId: string,
  direction: SplitDirection,
  newPaneId: string,
  newPtyId: string
): SplitNode {
  if (node.type === 'leaf') {
    if (node.paneId === targetPaneId) {
      return {
        type: 'split',
        direction,
        ratio: 0.5,
        first: node,
        second: { type: 'leaf', paneId: newPaneId, ptyId: newPtyId }
      }
    }
    return node
  }
  return {
    ...node,
    first: splitNode(node.first, targetPaneId, direction, newPaneId, newPtyId),
    second: splitNode(node.second, targetPaneId, direction, newPaneId, newPtyId)
  }
}

function removeNode(node: SplitNode, targetPaneId: string): SplitNode | null {
  if (node.type === 'leaf') {
    return node.paneId === targetPaneId ? null : node
  }
  const first = removeNode(node.first, targetPaneId)
  const second = removeNode(node.second, targetPaneId)
  if (!first) return second
  if (!second) return first
  return { ...node, first, second }
}

function findParentSplit(node: SplitNode, targetPaneId: string): SplitNode | null {
  if (node.type === 'leaf') return null
  const isFirstTarget =
    (node.first.type === 'leaf' && node.first.paneId === targetPaneId) ||
    (node.second.type === 'leaf' && node.second.paneId === targetPaneId)
  if (isFirstTarget) return node
  return findParentSplit(node.first, targetPaneId) || findParentSplit(node.second, targetPaneId)
}

function updateRatio(node: SplitNode, targetPaneId: string, ratio: number): SplitNode {
  if (node.type === 'leaf') return node
  const parent = findParentSplit(node, targetPaneId)
  if (parent === node) {
    return { ...node, ratio }
  }
  return {
    ...node,
    first: updateRatio(node.first, targetPaneId, ratio),
    second: updateRatio(node.second, targetPaneId, ratio)
  }
}

function findFirstLeaf(node: SplitNode): string {
  if (node.type === 'leaf') return node.paneId
  return findFirstLeaf(node.first)
}

export function collectPtyIds(node: SplitNode): string[] {
  if (node.type === 'leaf') return [node.ptyId]
  return [...collectPtyIds(node.first), ...collectPtyIds(node.second)]
}

export function findPtyForPane(node: SplitNode, paneId: string): string | null {
  if (node.type === 'leaf') {
    return node.paneId === paneId ? node.ptyId : null
  }
  return findPtyForPane(node.first, paneId) || findPtyForPane(node.second, paneId)
}

export const createPanesSlice: StateCreator<
  TabsSlice & PanesSlice & TerminalsSlice & TmuxSlice,
  [],
  [],
  PanesSlice
> = (set) => ({
  splitPane: (tabId, paneId, direction, newPaneId, newPtyId) =>
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t
        return {
          ...t,
          rootNode: splitNode(t.rootNode, paneId, direction, newPaneId, newPtyId),
          activePaneId: newPaneId
        }
      })
    })),

  closePane: (tabId, paneId) =>
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t
        const newRoot = removeNode(t.rootNode, paneId)
        if (!newRoot) return t
        return {
          ...t,
          rootNode: newRoot,
          activePaneId: t.activePaneId === paneId ? findFirstLeaf(newRoot) : t.activePaneId
        }
      })
    })),

  resizePane: (tabId, paneId, ratio) =>
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t
        return { ...t, rootNode: updateRatio(t.rootNode, paneId, ratio) }
      })
    }))
})
