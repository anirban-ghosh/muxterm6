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
  tmuxPaneId?: string
}

export const TerminalView: React.FC<TerminalViewProps> = ({ paneId, ptyId, isActive, onFocus, tmuxPaneId }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const ptyIdRef = useRef(ptyId)
  ptyIdRef.current = ptyId
  const tmuxPaneIdRef = useRef(tmuxPaneId)
  tmuxPaneIdRef.current = tmuxPaneId

  const setTerminal = useStore((s) => s.setTerminal)
  const updateTerminalSize = useStore((s) => s.updateTerminalSize)

  const handleData = useCallback((data: string) => {
    if (tmuxPaneIdRef.current) {
      window.terminalAPI.writeTmuxPane(tmuxPaneIdRef.current, data)
    } else {
      window.terminalAPI.writePty(ptyIdRef.current, data)
    }
  }, [])

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      if (tmuxPaneIdRef.current) {
        // Report actual xterm.js dimensions to main process.
        // TmuxSession computes total client size from all pane sizes + layout tree.
        window.terminalAPI.tmuxPaneResized(tmuxPaneIdRef.current, cols, rows)
      } else {
        window.terminalAPI.resizePty(ptyIdRef.current, cols, rows)
        updateTerminalSize(ptyIdRef.current, cols, rows)
      }
    },
    [updateTerminalSize]
  )

  const terminal = useTerminal({
    theme: darkTheme,
    onData: handleData,
    onResize: handleResize
  })

  // Set up output listener — different for tmux vs normal mode
  useEffect(() => {
    if (tmuxPaneId) {
      const offOutput = window.terminalAPI.onTmuxOutput((id, data) => {
        if (id === tmuxPaneId) {
          terminal.write(data)
        }
      })
      const offScrollback = window.terminalAPI.onTmuxScrollback((id, data) => {
        if (id === tmuxPaneId) {
          terminal.write(data)
        }
      })
      return () => {
        offOutput()
        offScrollback()
      }
    } else {
      const off = window.terminalAPI.onPtyOutput((id, data) => {
        if (id === ptyId) {
          terminal.write(data)
        }
      })
      return off
    }
  }, [ptyId, tmuxPaneId, terminal])

  // Mount terminal to container
  useEffect(() => {
    if (containerRef.current) {
      terminal.attach(containerRef.current)
      if (tmuxPaneId) {
        // Write scrollback data if available (read non-destructively —
        // React StrictMode double-mounts would lose consumed data)
        const scrollback = useStore.getState().tmuxScrollback[tmuxPaneId]
        if (scrollback) {
          terminal.write(scrollback)
        }
        // Tmux forwards mouse-enable sequences in %output. xterm.js processes
        // them and enters mouse mode. Mouse events are forwarded via send-keys.
      } else {
        const size = terminal.getSize()
        if (size) {
          window.terminalAPI.resizePty(ptyId, size.cols, size.rows)
          updateTerminalSize(ptyId, size.cols, size.rows)
        }
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
