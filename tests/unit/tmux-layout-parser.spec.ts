import { describe, it, expect } from 'vitest'
import { parseTmuxLayout } from '../../src/main/tmux/tmux-layout-parser'

describe('parseTmuxLayout', () => {
  it('should parse single pane layout', () => {
    // Single pane: checksum,WxH,X,Y,PANE_ID
    const node = parseTmuxLayout('d5a5,202x51,0,0,0')
    expect(node).toEqual({
      type: 'leaf',
      paneId: 'tmux-pane-0',
      ptyId: '',
      tmuxPaneId: '%0'
    })
  })

  it('should parse two-way vertical split (left-right)', () => {
    // {child1,child2} = horizontal arrangement = our 'vertical' direction
    const node = parseTmuxLayout('34a4,202x51,0,0{101x51,0,0,0,100x51,102,0,1}')
    expect(node.type).toBe('split')
    if (node.type !== 'split') return
    expect(node.direction).toBe('vertical')
    expect(node.first).toEqual({
      type: 'leaf',
      paneId: 'tmux-pane-0',
      ptyId: '',
      tmuxPaneId: '%0'
    })
    expect(node.second).toEqual({
      type: 'leaf',
      paneId: 'tmux-pane-1',
      ptyId: '',
      tmuxPaneId: '%1'
    })
    // Ratio should be approximately 101/203 (101 + 1 divider + 100 = 202)
    expect(node.ratio).toBeCloseTo(101 / 202, 2)
  })

  it('should parse two-way horizontal split (top-bottom)', () => {
    // [child1,child2] = vertical arrangement = our 'horizontal' direction
    const node = parseTmuxLayout('8b55,202x51,0,0[202x25,0,0,0,202x25,0,26,1]')
    expect(node.type).toBe('split')
    if (node.type !== 'split') return
    expect(node.direction).toBe('horizontal')
    expect(node.first.type).toBe('leaf')
    expect(node.second.type).toBe('leaf')
  })

  it('should parse three-way split as binary tree', () => {
    // Three panes side by side: {A,B,C} -> split(A, split(B, C))
    const node = parseTmuxLayout('abcd,300x50,0,0{100x50,0,0,0,99x50,101,0,1,99x50,201,0,2}')
    expect(node.type).toBe('split')
    if (node.type !== 'split') return
    expect(node.direction).toBe('vertical')
    expect(node.first.type).toBe('leaf')
    expect(node.second.type).toBe('split')
    if (node.second.type !== 'split') return
    expect(node.second.first.type).toBe('leaf')
    expect(node.second.second.type).toBe('leaf')
  })

  it('should parse nested splits', () => {
    // Left-right split where left is further split top-bottom
    // {[A,B],C}
    const node = parseTmuxLayout(
      'beef,202x51,0,0{100x51,0,0[100x25,0,0,0,100x25,0,26,1],101x51,101,0,2}'
    )
    expect(node.type).toBe('split')
    if (node.type !== 'split') return
    expect(node.direction).toBe('vertical')

    // Left child should be a horizontal split
    expect(node.first.type).toBe('split')
    if (node.first.type !== 'split') return
    expect(node.first.direction).toBe('horizontal')

    // Right child should be a leaf
    expect(node.second.type).toBe('leaf')
    if (node.second.type !== 'leaf') return
    expect(node.second.tmuxPaneId).toBe('%2')
  })

  it('should assign correct tmux pane IDs', () => {
    const node = parseTmuxLayout('34a4,202x51,0,0{101x51,0,0,5,100x51,102,0,12}')
    if (node.type !== 'split') return
    if (node.first.type !== 'leaf' || node.second.type !== 'leaf') return
    expect(node.first.tmuxPaneId).toBe('%5')
    expect(node.second.tmuxPaneId).toBe('%12')
  })
})
