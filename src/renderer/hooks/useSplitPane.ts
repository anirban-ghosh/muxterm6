import { useCallback } from 'react'
import { useStore } from '../store'
import type { SplitDirection } from '../../shared/types'

let paneCounter = 0
function generatePaneId(): string {
  return `pane-${++paneCounter}`
}

export function useSplitPane() {
  const splitPane = useStore((s) => s.splitPane)
  const closePane = useStore((s) => s.closePane)
  const resizePane = useStore((s) => s.resizePane)

  const split = useCallback(
    async (tabId: string, paneId: string, direction: SplitDirection) => {
      const newPaneId = generatePaneId()
      const result = await window.terminalAPI.createPty()
      splitPane(tabId, paneId, direction, newPaneId, result.ptyId)
      return { newPaneId, ptyId: result.ptyId, pid: result.pid, shell: result.shell }
    },
    [splitPane]
  )

  const close = useCallback(
    (tabId: string, paneId: string, ptyId: string) => {
      window.terminalAPI.destroyPty(ptyId)
      closePane(tabId, paneId)
    },
    [closePane]
  )

  const resize = useCallback(
    (tabId: string, paneId: string, ratio: number) => {
      resizePane(tabId, paneId, ratio)
    },
    [resizePane]
  )

  return { split, close, resize }
}
