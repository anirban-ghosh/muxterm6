/**
 * Parse tmux layout strings into SplitNode trees.
 *
 * Format: CHECKSUM,WxH,X,Y{children} or [children]
 * - {...} = horizontal arrangement (left-right) -> our direction: 'vertical'
 * - [...] = vertical arrangement (top-bottom) -> our direction: 'horizontal'
 * - Leaf: WxH,X,Y,PANE_ID
 *
 * N-ary trees are converted to binary by nesting: split(c1, split(c2, c3))
 * Ratios are computed from child dimensions.
 */

import type { SplitNode, SplitDirection } from '../../shared/types'

interface ParseResult {
  node: SplitNode
  width: number
  height: number
  endIndex: number
}

/**
 * Parse a tmux layout string into a SplitNode tree.
 * Input: full layout string like "34a4,202x51,0,0{101x51,0,0,0,100x51,102,0,1}"
 * Strips leading checksum before parsing.
 */
export function parseTmuxLayout(layout: string): SplitNode {
  // Strip leading checksum: "XXXX," format
  const commaIdx = layout.indexOf(',')
  if (commaIdx === -1) throw new Error(`Invalid tmux layout: ${layout}`)
  const body = layout.substring(commaIdx + 1)
  return parseNode(body, 0).node
}

function parseNode(s: string, pos: number): ParseResult {
  // Parse WxH
  const xIdx = s.indexOf('x', pos)
  if (xIdx === -1) throw new Error(`Expected WxH at pos ${pos}`)
  const width = parseInt(s.substring(pos, xIdx), 10)

  // Find the comma after H
  let i = xIdx + 1
  while (i < s.length && s[i] >= '0' && s[i] <= '9') i++
  const height = parseInt(s.substring(xIdx + 1, i), 10)

  // Skip ,X,Y
  if (s[i] !== ',') throw new Error(`Expected comma after H at pos ${i}`)
  i++ // skip comma
  // skip X
  while (i < s.length && s[i] >= '0' && s[i] <= '9') i++
  if (s[i] !== ',') throw new Error(`Expected comma after X at pos ${i}`)
  i++ // skip comma
  // skip Y
  while (i < s.length && s[i] >= '0' && s[i] <= '9') i++

  // Check what follows: '{', '[', or ',PANE_ID' (leaf)
  if (i < s.length && (s[i] === '{' || s[i] === '[')) {
    const bracket = s[i]
    const closeBracket = bracket === '{' ? '}' : ']'
    const direction: SplitDirection = bracket === '{' ? 'vertical' : 'horizontal'
    i++ // skip opening bracket

    const children: { node: SplitNode; width: number; height: number }[] = []

    while (i < s.length && s[i] !== closeBracket) {
      if (s[i] === ',') i++ // skip separator commas between children
      const result = parseNode(s, i)
      children.push({ node: result.node, width: result.width, height: result.height })
      i = result.endIndex
    }

    if (i < s.length && s[i] === closeBracket) i++ // skip closing bracket

    const node = buildBinaryTree(children, direction)
    return { node, width, height, endIndex: i }
  } else {
    // Leaf node: ,PANE_ID
    if (s[i] !== ',') throw new Error(`Expected comma before pane ID at pos ${i}`)
    i++ // skip comma
    let paneIdStr = ''
    while (i < s.length && s[i] >= '0' && s[i] <= '9') {
      paneIdStr += s[i]
      i++
    }
    const tmuxPaneId = `%${paneIdStr}`
    return {
      node: {
        type: 'leaf',
        paneId: `tmux-pane-${paneIdStr}`,
        ptyId: '',
        tmuxPaneId
      },
      width,
      height,
      endIndex: i
    }
  }
}

/**
 * Convert N children into a binary tree.
 * split(c1, split(c2, c3)) with ratio from cumulative dimensions.
 */
function buildBinaryTree(
  children: { node: SplitNode; width: number; height: number }[],
  direction: SplitDirection
): SplitNode {
  if (children.length === 1) return children[0].node
  if (children.length === 0) throw new Error('Empty children list')

  const first = children[0]
  const rest = children.slice(1)

  // Compute ratio based on dimension in the split direction
  const totalDim = children.reduce(
    (sum, c) => sum + (direction === 'vertical' ? c.width : c.height),
    0
  )
  // Account for dividers between children (1px each)
  const totalWithDividers = totalDim + (children.length - 1)
  const firstDim = direction === 'vertical' ? first.width : first.height
  const ratio = firstDim / totalWithDividers

  const secondNode =
    rest.length === 1
      ? rest[0].node
      : buildBinaryTree(rest, direction)

  return {
    type: 'split',
    direction,
    ratio,
    first: first.node,
    second: secondNode
  }
}
