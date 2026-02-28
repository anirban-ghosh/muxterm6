import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import type { MuxTheme } from '../themes/theme'

interface UseTerminalOptions {
  theme: MuxTheme
  onData: (data: string) => void
  onResize: (cols: number, rows: number) => void
  onTitle?: (title: string) => void
}

/**
 * Track mouse mode state by watching escape sequences written to the terminal.
 * xterm.js's internal MouseService fails when renderService.dimensions is undefined
 * (a known issue with terminal initialization timing), so we handle mouse events
 * manually and generate escape sequences ourselves.
 */
class MouseModeTracker {
  // Mouse tracking modes
  x10 = false       // ?9h — X10 compatibility (press only)
  vt200 = false     // ?1000h — normal tracking (press + release)
  buttonEvent = false // ?1002h — button-event tracking (press + release + motion while pressed)
  anyEvent = false   // ?1003h — any-event tracking (all motion)
  sgrMode = false    // ?1006h — SGR extended coordinates

  get isActive(): boolean {
    return this.x10 || this.vt200 || this.buttonEvent || this.anyEvent
  }

  /** Scan data for mouse mode enable/disable sequences and update state */
  scan(data: string): void {
    // Match DECSET/DECRST sequences: \x1b[?NNNh (enable) or \x1b[?NNNl (disable)
    // Tmux often sends multiple modes in one chunk
    let i = 0
    while (i < data.length) {
      if (data.charCodeAt(i) === 0x1b && i + 1 < data.length && data.charCodeAt(i + 1) === 0x5b) {
        // Found ESC[
        const start = i
        i += 2
        if (i < data.length && data.charCodeAt(i) === 0x3f) {
          // Found ESC[?
          i++
          let num = ''
          while (i < data.length && data.charCodeAt(i) >= 0x30 && data.charCodeAt(i) <= 0x39) {
            num += data[i]
            i++
          }
          if (i < data.length && num) {
            const code = parseInt(num, 10)
            const enable = data.charCodeAt(i) === 0x68 // 'h'
            const disable = data.charCodeAt(i) === 0x6c // 'l'
            if (enable || disable) {
              this.setMode(code, enable)
              i++
              continue
            }
          }
        }
        i = start + 1
      } else {
        i++
      }
    }
  }

  private setMode(code: number, enable: boolean): void {
    switch (code) {
      case 9: this.x10 = enable; break
      case 1000: this.vt200 = enable; break
      case 1002: this.buttonEvent = enable; break
      case 1003: this.anyEvent = enable; break
      case 1006: this.sgrMode = enable; break
    }
  }

  reset(): void {
    this.x10 = false
    this.vt200 = false
    this.buttonEvent = false
    this.anyEvent = false
    this.sgrMode = false
  }
}

/**
 * Generate mouse escape sequences for a given event.
 * Supports both legacy X10/VT200 encoding and SGR extended encoding.
 */
function encodeMouseEvent(
  tracker: MouseModeTracker,
  type: 'press' | 'release' | 'move',
  button: number, // 0=left, 1=middle, 2=right
  col: number, // 1-based
  row: number, // 1-based
  modifiers: { shift: boolean; meta: boolean; ctrl: boolean }
): string | null {
  if (!tracker.isActive) return null

  // For X10 mode, only report presses
  if (tracker.x10 && type !== 'press') return null

  // For VT200 mode, report press and release
  if (tracker.vt200 && type === 'move') return null

  // For button-event mode, report motion only when a button is pressed
  // (handled by caller — we always encode if called)

  let cb = button
  if (type === 'release' && !tracker.sgrMode) {
    cb = 3 // release is encoded as button 3 in legacy mode
  }
  if (type === 'move') {
    cb += 32 // motion flag
  }
  if (modifiers.shift) cb += 4
  if (modifiers.meta) cb += 8
  if (modifiers.ctrl) cb += 16

  if (tracker.sgrMode) {
    // SGR format: ESC[<Cb;Cx;CyM (press) or ESC[<Cb;Cx;Cym (release)
    const suffix = type === 'release' ? 'm' : 'M'
    return `\x1b[<${cb};${col};${row}${suffix}`
  } else {
    // Legacy format: ESC[M Cb Cx Cy (all +32 offset, max 223 for coords)
    if (col > 223 || row > 223) return null // can't encode in legacy mode
    return `\x1b[M${String.fromCharCode(cb + 32)}${String.fromCharCode(col + 32)}${String.fromCharCode(row + 32)}`
  }
}

export function useTerminal(options: UseTerminalOptions) {
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const mouseTrackerRef = useRef(new MouseModeTracker())
  const mouseAbortRef = useRef<AbortController | null>(null)

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

      // Fit first with the default canvas renderer
      fitAddon.fit()

      // WebGL addon disabled — causes "dimensions" errors that corrupt
      // xterm.js renderer state. Canvas/DOM renderer works correctly.

      // Intercept Ctrl+Tab / Ctrl+Shift+Tab so they bubble up to Electron's
      // menu accelerator for tab switching instead of being consumed by xterm.js.
      terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === 'Tab') return false
        return true
      })

      terminal.onData(options.onData)
      terminal.onResize(({ cols, rows }) => options.onResize(cols, rows))
      if (options.onTitle) {
        terminal.onTitleChange(options.onTitle)
      }

      // Manual mouse event handling to work around xterm.js dimensions bug.
      // xterm.js's MouseService.getCoords() fails when renderService.dimensions
      // is undefined, so we calculate cell positions ourselves.
      // Use AbortController to cleanly remove all listeners on dispose
      // (React StrictMode double-mounts would otherwise leave stale listeners).
      mouseAbortRef.current?.abort()
      const mouseAbort = new AbortController()
      mouseAbortRef.current = mouseAbort
      const mouseTracker = mouseTrackerRef.current
      let pressedButton = -1

      const getCellCoords = (e: MouseEvent): { col: number; row: number } | null => {
        // Find the xterm screen element to get the correct offset
        const screen = container.querySelector('.xterm-screen') as HTMLElement
        if (!screen) return null
        const rect = screen.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null
        const cellWidth = rect.width / terminal.cols
        const cellHeight = rect.height / terminal.rows
        const col = Math.floor(x / cellWidth) + 1 // 1-based
        const row = Math.floor(y / cellHeight) + 1 // 1-based
        return { col, row }
      }

      const getModifiers = (e: MouseEvent) => ({
        shift: e.shiftKey,
        meta: e.metaKey,
        ctrl: e.ctrlKey
      })

      const handleMouseDown = (e: MouseEvent) => {
        if (!mouseTracker.isActive) return
        const coords = getCellCoords(e)
        if (!coords) return
        pressedButton = e.button // 0=left, 1=middle, 2=right
        const seq = encodeMouseEvent(mouseTracker, 'press', e.button, coords.col, coords.row, getModifiers(e))
        if (seq) {
          terminal.focus()
          options.onData(seq)
          e.preventDefault()
          e.stopPropagation()
        }
      }

      const handleMouseUp = (e: MouseEvent) => {
        if (!mouseTracker.isActive) return
        if (mouseTracker.x10) return // X10 doesn't report release
        const coords = getCellCoords(e)
        if (!coords) return
        const seq = encodeMouseEvent(mouseTracker, 'release', e.button, coords.col, coords.row, getModifiers(e))
        if (seq) {
          options.onData(seq)
          e.preventDefault()
        }
        pressedButton = -1
      }

      const handleMouseMove = (e: MouseEvent) => {
        if (!mouseTracker.isActive) return
        if (mouseTracker.anyEvent || (mouseTracker.buttonEvent && pressedButton >= 0)) {
          const coords = getCellCoords(e)
          if (!coords) return
          const btn = pressedButton >= 0 ? pressedButton : 0
          const seq = encodeMouseEvent(mouseTracker, 'move', btn, coords.col, coords.row, getModifiers(e))
          if (seq) {
            options.onData(seq)
            e.preventDefault()
          }
        }
      }

      const handleWheel = (e: WheelEvent) => {
        if (!mouseTracker.isActive) return
        const coords = getCellCoords(e)
        if (!coords) return
        // Wheel up = button 64, wheel down = button 65
        const button = e.deltaY < 0 ? 64 : 65
        const seq = encodeMouseEvent(mouseTracker, 'press', button, coords.col, coords.row, getModifiers(e))
        if (seq) {
          options.onData(seq)
          e.preventDefault()
        }
      }

      const handleContextMenu = (e: MouseEvent) => {
        if (mouseTracker.isActive) {
          e.preventDefault()
        }
      }

      const listenerOpts = { capture: true, signal: mouseAbort.signal }
      container.addEventListener('mousedown', handleMouseDown, listenerOpts)
      container.addEventListener('mouseup', handleMouseUp, listenerOpts)
      container.addEventListener('mousemove', handleMouseMove, listenerOpts)
      container.addEventListener('wheel', handleWheel, listenerOpts as any)
      container.addEventListener('contextmenu', handleContextMenu, listenerOpts)

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
    // Track mouse mode sequences so our manual handler knows when to activate
    mouseTrackerRef.current.scan(data)
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
    mouseAbortRef.current?.abort()
    mouseTrackerRef.current.reset()
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
