import React, { useEffect, useRef, useCallback } from 'react'
import { useTerminal } from '../../hooks/useTerminal'
import { useStore } from '../../store'
import { darkTheme } from '../../themes/dark'
import '@xterm/xterm/css/xterm.css'

interface TerminalViewProps {
  paneId: string
  ptyId: string
  isActive: boolean
  onFocus: () => void
}

export const TerminalView: React.FC<TerminalViewProps> = ({ paneId, ptyId, isActive, onFocus }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const ptyIdRef = useRef(ptyId)
  ptyIdRef.current = ptyId

  const setTerminal = useStore((s) => s.setTerminal)
  const updateTerminalSize = useStore((s) => s.updateTerminalSize)

  const handleData = useCallback((data: string) => {
    window.terminalAPI.writePty(ptyIdRef.current, data)
  }, [])

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      window.terminalAPI.resizePty(ptyIdRef.current, cols, rows)
      updateTerminalSize(ptyIdRef.current, cols, rows)
    },
    [updateTerminalSize]
  )

  const terminal = useTerminal({
    theme: darkTheme,
    onData: handleData,
    onResize: handleResize
  })

  // Set up output listener
  useEffect(() => {
    const off = window.terminalAPI.onPtyOutput((id, data) => {
      if (id === ptyId) {
        terminal.write(data)
      }
    })
    return off
  }, [ptyId, terminal])

  // Mount terminal to container
  useEffect(() => {
    if (containerRef.current) {
      terminal.attach(containerRef.current)
      const size = terminal.getSize()
      if (size) {
        window.terminalAPI.resizePty(ptyId, size.cols, size.rows)
        updateTerminalSize(ptyId, size.cols, size.rows)
      }
    }
  }, []) // mount once

  // Focus when active
  useEffect(() => {
    if (isActive) {
      terminal.focus()
    }
  }, [isActive, terminal])

  return (
    <div
      className={`terminal-view ${isActive ? 'terminal-view--active' : ''}`}
      ref={containerRef}
      onMouseDown={onFocus}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      }}
    />
  )
}
