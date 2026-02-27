import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import type { MuxTheme } from '../themes/theme'

interface UseTerminalOptions {
  theme: MuxTheme
  onData: (data: string) => void
  onResize: (cols: number, rows: number) => void
  onTitle?: (title: string) => void
}

export function useTerminal(options: UseTerminalOptions) {
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const attach = useCallback(
    (container: HTMLDivElement) => {
      if (termRef.current) return

      containerRef.current = container

      const terminal = new Terminal({
        fontFamily: options.theme.font.family,
        fontSize: options.theme.font.size,
        lineHeight: options.theme.font.lineHeight,
        cursorBlink: true,
        cursorStyle: 'bar',
        allowProposedApi: true,
        theme: {
          background: options.theme.terminal.background,
          foreground: options.theme.terminal.foreground,
          cursor: options.theme.terminal.cursor,
          cursorAccent: options.theme.terminal.cursorAccent,
          selectionBackground: options.theme.terminal.selectionBackground,
          selectionForeground: options.theme.terminal.selectionForeground,
          black: options.theme.terminal.black,
          red: options.theme.terminal.red,
          green: options.theme.terminal.green,
          yellow: options.theme.terminal.yellow,
          blue: options.theme.terminal.blue,
          magenta: options.theme.terminal.magenta,
          cyan: options.theme.terminal.cyan,
          white: options.theme.terminal.white,
          brightBlack: options.theme.terminal.brightBlack,
          brightRed: options.theme.terminal.brightRed,
          brightGreen: options.theme.terminal.brightGreen,
          brightYellow: options.theme.terminal.brightYellow,
          brightBlue: options.theme.terminal.brightBlue,
          brightMagenta: options.theme.terminal.brightMagenta,
          brightCyan: options.theme.terminal.brightCyan,
          brightWhite: options.theme.terminal.brightWhite
        }
      })

      const fitAddon = new FitAddon()
      fitAddonRef.current = fitAddon
      terminal.loadAddon(fitAddon)

      terminal.loadAddon(new WebLinksAddon())

      const unicodeAddon = new Unicode11Addon()
      terminal.loadAddon(unicodeAddon)
      terminal.unicode.activeVersion = '11'

      terminal.open(container)

      try {
        const webglAddon = new WebglAddon()
        webglAddon.onContextLoss(() => {
          webglAddon.dispose()
        })
        terminal.loadAddon(webglAddon)
      } catch {
        // WebGL not available, fall back to canvas
      }

      fitAddon.fit()

      terminal.onData(options.onData)
      terminal.onResize(({ cols, rows }) => options.onResize(cols, rows))
      if (options.onTitle) {
        terminal.onTitleChange(options.onTitle)
      }

      const ro = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          if (fitAddonRef.current) {
            try {
              fitAddonRef.current.fit()
            } catch {
              // ignore fit errors during rapid resize
            }
          }
        })
      })
      ro.observe(container)
      resizeObserverRef.current = ro

      termRef.current = terminal
    },
    [] // stable ref — theme/callbacks captured via ref pattern below
  )

  const write = useCallback((data: string) => {
    termRef.current?.write(data)
  }, [])

  const focus = useCallback(() => {
    termRef.current?.focus()
  }, [])

  const fit = useCallback(() => {
    fitAddonRef.current?.fit()
  }, [])

  const getSize = useCallback(() => {
    const t = termRef.current
    return t ? { cols: t.cols, rows: t.rows } : null
  }, [])

  const dispose = useCallback(() => {
    resizeObserverRef.current?.disconnect()
    termRef.current?.dispose()
    termRef.current = null
    fitAddonRef.current = null
    containerRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      dispose()
    }
  }, [dispose])

  return { attach, write, focus, fit, getSize, dispose, termRef }
}
