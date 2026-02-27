import { describe, it, expect } from 'vitest'
import type { SplitNode } from '../../src/shared/types'

// Re-implement tree functions here for unit testing (they're embedded in the store)
function splitNode(
  node: SplitNode,
  targetPaneId: string,
  direction: 'horizontal' | 'vertical',
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

function collectPtyIds(node: SplitNode): string[] {
  if (node.type === 'leaf') return [node.ptyId]
  return [...collectPtyIds(node.first), ...collectPtyIds(node.second)]
}

function findFirstLeaf(node: SplitNode): string {
  if (node.type === 'leaf') return node.paneId
  return findFirstLeaf(node.first)
}

describe('SplitNode tree operations', () => {
  const leaf: SplitNode = { type: 'leaf', paneId: 'p1', ptyId: 'pty-1' }

  describe('splitNode', () => {
    it('should split a leaf into a split node', () => {
      const result = splitNode(leaf, 'p1', 'vertical', 'p2', 'pty-2')
      expect(result.type).toBe('split')
      if (result.type === 'split') {
        expect(result.direction).toBe('vertical')
        expect(result.ratio).toBe(0.5)
        expect(result.first).toEqual(leaf)
        expect(result.second).toEqual({ type: 'leaf', paneId: 'p2', ptyId: 'pty-2' })
      }
    })

    it('should not split when paneId does not match', () => {
      const result = splitNode(leaf, 'nonexistent', 'vertical', 'p2', 'pty-2')
      expect(result).toEqual(leaf)
    })

    it('should split nested nodes', () => {
      const split: SplitNode = {
        type: 'split',
        direction: 'vertical',
        ratio: 0.5,
        first: { type: 'leaf', paneId: 'p1', ptyId: 'pty-1' },
        second: { type: 'leaf', paneId: 'p2', ptyId: 'pty-2' }
      }
      const result = splitNode(split, 'p2', 'horizontal', 'p3', 'pty-3')
      expect(result.type).toBe('split')
      if (result.type === 'split') {
        expect(result.first).toEqual({ type: 'leaf', paneId: 'p1', ptyId: 'pty-1' })
        expect(result.second.type).toBe('split')
        if (result.second.type === 'split') {
          expect(result.second.direction).toBe('horizontal')
        }
      }
    })
  })

  describe('removeNode', () => {
    it('should return null when removing the only leaf', () => {
      const result = removeNode(leaf, 'p1')
      expect(result).toBeNull()
    })

    it('should return the leaf unchanged when paneId does not match', () => {
      const result = removeNode(leaf, 'nonexistent')
      expect(result).toEqual(leaf)
    })

    it('should collapse split to remaining leaf when removing one child', () => {
      const split: SplitNode = {
        type: 'split',
        direction: 'vertical',
        ratio: 0.5,
        first: { type: 'leaf', paneId: 'p1', ptyId: 'pty-1' },
        second: { type: 'leaf', paneId: 'p2', ptyId: 'pty-2' }
      }
      const result = removeNode(split, 'p1')
      expect(result).toEqual({ type: 'leaf', paneId: 'p2', ptyId: 'pty-2' })
    })
  })

  describe('collectPtyIds', () => {
    it('should collect single pty from leaf', () => {
      expect(collectPtyIds(leaf)).toEqual(['pty-1'])
    })

    it('should collect all ptys from nested tree', () => {
      const tree: SplitNode = {
        type: 'split',
        direction: 'vertical',
        ratio: 0.5,
        first: { type: 'leaf', paneId: 'p1', ptyId: 'pty-1' },
        second: {
          type: 'split',
          direction: 'horizontal',
          ratio: 0.5,
          first: { type: 'leaf', paneId: 'p2', ptyId: 'pty-2' },
          second: { type: 'leaf', paneId: 'p3', ptyId: 'pty-3' }
        }
      }
      expect(collectPtyIds(tree)).toEqual(['pty-1', 'pty-2', 'pty-3'])
    })
  })

  describe('findFirstLeaf', () => {
    it('should return the paneId of a leaf', () => {
      expect(findFirstLeaf(leaf)).toBe('p1')
    })

    it('should return leftmost leaf in a tree', () => {
      const tree: SplitNode = {
        type: 'split',
        direction: 'vertical',
        ratio: 0.5,
        first: {
          type: 'split',
          direction: 'horizontal',
          ratio: 0.5,
          first: { type: 'leaf', paneId: 'deepest', ptyId: 'pty-d' },
          second: { type: 'leaf', paneId: 'p2', ptyId: 'pty-2' }
        },
        second: { type: 'leaf', paneId: 'p3', ptyId: 'pty-3' }
      }
      expect(findFirstLeaf(tree)).toBe('deepest')
    })
  })
})
