import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../../src/renderer/store'
import type { Tab } from '../../src/shared/types'

describe('Zustand store', () => {
  beforeEach(() => {
    // Reset store
    useStore.setState({
      tabs: [],
      activeTabId: null,
      terminals: {}
    })
  })

  describe('tabs slice', () => {
    const makeTab = (id: string): Tab => ({
      id,
      title: `Tab ${id}`,
      rootNode: { type: 'leaf', paneId: `pane-${id}`, ptyId: `pty-${id}` },
      activePaneId: `pane-${id}`
    })

    it('should add a tab and set it active', () => {
      const tab = makeTab('1')
      useStore.getState().addTab(tab)

      const state = useStore.getState()
      expect(state.tabs).toHaveLength(1)
      expect(state.activeTabId).toBe('1')
    })

    it('should remove a tab and update active tab', () => {
      useStore.getState().addTab(makeTab('1'))
      useStore.getState().addTab(makeTab('2'))
      useStore.getState().setActiveTab('1')
      useStore.getState().removeTab('1')

      const state = useStore.getState()
      expect(state.tabs).toHaveLength(1)
      expect(state.activeTabId).toBe('2')
    })

    it('should set activeTabId to null when last tab is removed', () => {
      useStore.getState().addTab(makeTab('1'))
      useStore.getState().removeTab('1')

      expect(useStore.getState().activeTabId).toBeNull()
    })

    it('should reorder tabs', () => {
      useStore.getState().addTab(makeTab('1'))
      useStore.getState().addTab(makeTab('2'))
      useStore.getState().addTab(makeTab('3'))
      useStore.getState().reorderTabs(0, 2)

      const ids = useStore.getState().tabs.map((t) => t.id)
      expect(ids).toEqual(['2', '3', '1'])
    })

    it('should update tab title', () => {
      useStore.getState().addTab(makeTab('1'))
      useStore.getState().updateTabTitle('1', 'New Title')

      expect(useStore.getState().tabs[0].title).toBe('New Title')
    })
  })

  describe('terminals slice', () => {
    it('should set and remove terminal metadata', () => {
      useStore.getState().setTerminal('pty-1', {
        ptyId: 'pty-1',
        pid: 123,
        shell: '/bin/zsh',
        cols: 80,
        rows: 24
      })

      expect(useStore.getState().terminals['pty-1']).toBeDefined()
      expect(useStore.getState().terminals['pty-1'].pid).toBe(123)

      useStore.getState().removeTerminal('pty-1')
      expect(useStore.getState().terminals['pty-1']).toBeUndefined()
    })

    it('should update terminal size', () => {
      useStore.getState().setTerminal('pty-1', {
        ptyId: 'pty-1',
        pid: 123,
        shell: '/bin/zsh',
        cols: 80,
        rows: 24
      })
      useStore.getState().updateTerminalSize('pty-1', 120, 40)

      const meta = useStore.getState().terminals['pty-1']
      expect(meta.cols).toBe(120)
      expect(meta.rows).toBe(40)
    })
  })

  describe('panes slice', () => {
    it('should split a pane', () => {
      const tab: Tab = {
        id: 't1',
        title: 'Test',
        rootNode: { type: 'leaf', paneId: 'p1', ptyId: 'pty-1' },
        activePaneId: 'p1'
      }
      useStore.getState().addTab(tab)
      useStore.getState().splitPane('t1', 'p1', 'vertical', 'p2', 'pty-2')

      const updated = useStore.getState().tabs[0]
      expect(updated.rootNode.type).toBe('split')
      expect(updated.activePaneId).toBe('p2')
    })

    it('should close a pane and collapse split', () => {
      const tab: Tab = {
        id: 't1',
        title: 'Test',
        rootNode: { type: 'leaf', paneId: 'p1', ptyId: 'pty-1' },
        activePaneId: 'p1'
      }
      useStore.getState().addTab(tab)
      useStore.getState().splitPane('t1', 'p1', 'vertical', 'p2', 'pty-2')
      useStore.getState().closePane('t1', 'p2')

      const updated = useStore.getState().tabs[0]
      expect(updated.rootNode.type).toBe('leaf')
      if (updated.rootNode.type === 'leaf') {
        expect(updated.rootNode.paneId).toBe('p1')
      }
    })
  })
})
