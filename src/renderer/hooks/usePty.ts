import { useEffect, useRef, useCallback } from 'react'
import type { PtyCreateResult } from '../../shared/types'

interface UsePtyOptions {
  onOutput: (data: string) => void
  onExit: (exitCode: number) => void
  onTitle?: (title: string) => void
}

export function usePty(options: UsePtyOptions) {
  const ptyIdRef = useRef<string | null>(null)
  const cleanupRef = useRef<Array<() => void>>([])
  const optionsRef = useRef(options)
  optionsRef.current = options

  const create = useCallback(async (cols?: number, rows?: number): Promise<PtyCreateResult> => {
    const result = await window.terminalAPI.createPty(cols, rows)
    ptyIdRef.current = result.ptyId

    const offOutput = window.terminalAPI.onPtyOutput((id, data) => {
      if (id === ptyIdRef.current) {
        optionsRef.current.onOutput(data)
      }
    })

    const offExit = window.terminalAPI.onPtyExit((id, exitCode) => {
      if (id === ptyIdRef.current) {
        optionsRef.current.onExit(exitCode)
      }
    })

    const offTitle = window.terminalAPI.onPtyTitle((id, title) => {
      if (id === ptyIdRef.current && optionsRef.current.onTitle) {
        optionsRef.current.onTitle(title)
      }
    })

    cleanupRef.current = [offOutput, offExit, offTitle]
    return result
  }, [])

  const write = useCallback((data: string) => {
    if (ptyIdRef.current) {
      window.terminalAPI.writePty(ptyIdRef.current, data)
    }
  }, [])

  const resize = useCallback((cols: number, rows: number) => {
    if (ptyIdRef.current) {
      window.terminalAPI.resizePty(ptyIdRef.current, cols, rows)
    }
  }, [])

  const destroy = useCallback(() => {
    cleanupRef.current.forEach((fn) => fn())
    cleanupRef.current = []
    if (ptyIdRef.current) {
      window.terminalAPI.destroyPty(ptyIdRef.current)
      ptyIdRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      destroy()
    }
  }, [destroy])

  return { create, write, resize, destroy, ptyIdRef }
}
