import React, { useCallback, useRef } from 'react'
import type { SplitDirection } from '../../../shared/types'
import { MIN_SPLIT_RATIO, MAX_SPLIT_RATIO } from '../../../shared/constants'

interface SplitDividerProps {
  direction: SplitDirection
  onResize: (ratio: number) => void
  isTmux?: boolean
  onTmuxDividerResize?: (delta: number) => void
}

// Approximate character dimensions for computing column/row deltas
const CHAR_WIDTH = 8
const CHAR_HEIGHT = 17

export const SplitDivider: React.FC<SplitDividerProps> = ({
  direction,
  onResize,
  isTmux,
  onTmuxDividerResize
}) => {
  const dividerRef = useRef<HTMLDivElement>(null)
  const lastPosRef = useRef<number>(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const parent = dividerRef.current?.parentElement
      if (!parent) return

      const parentRect = parent.getBoundingClientRect()

      // Disable pointer events on terminal views during drag
      document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize'
      document.querySelectorAll('.terminal-view').forEach((el) => {
        ;(el as HTMLElement).style.pointerEvents = 'none'
      })

      if (isTmux && onTmuxDividerResize) {
        // Tmux mode: accumulate pixel delta, convert to cols/rows on mouseup
        const startPos = direction === 'vertical' ? e.clientX : e.clientY
        lastPosRef.current = startPos

        // Create shadow divider that follows the mouse during drag
        const dividerRect = dividerRef.current!.getBoundingClientRect()
        const shadow = document.createElement('div')
        shadow.className = `split-divider-shadow split-divider-shadow--${direction}`
        if (direction === 'vertical') {
          shadow.style.top = `${dividerRect.top}px`
          shadow.style.height = `${dividerRect.height}px`
          shadow.style.left = `${dividerRect.left}px`
        } else {
          shadow.style.left = `${dividerRect.left}px`
          shadow.style.width = `${dividerRect.width}px`
          shadow.style.top = `${dividerRect.top}px`
        }
        document.body.appendChild(shadow)

        const handleMouseMove = (moveEvent: MouseEvent) => {
          lastPosRef.current = direction === 'vertical' ? moveEvent.clientX : moveEvent.clientY
          // Move shadow to follow cursor
          if (direction === 'vertical') {
            shadow.style.left = `${moveEvent.clientX}px`
          } else {
            shadow.style.top = `${moveEvent.clientY}px`
          }
        }

        const handleMouseUp = () => {
          document.body.style.cursor = ''
          document.querySelectorAll('.terminal-view').forEach((el) => {
            ;(el as HTMLElement).style.pointerEvents = ''
          })
          document.removeEventListener('mousemove', handleMouseMove)
          document.removeEventListener('mouseup', handleMouseUp)
          shadow.remove()

          const endPos = lastPosRef.current
          const pixelDelta = endPos - startPos
          const charSize = direction === 'vertical' ? CHAR_WIDTH : CHAR_HEIGHT
          const delta = Math.round(pixelDelta / charSize)
          if (delta !== 0) {
            onTmuxDividerResize(delta)
          }
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
      } else {
        // Normal mode
        const handleMouseMove = (moveEvent: MouseEvent) => {
          let ratio: number
          if (direction === 'vertical') {
            ratio = (moveEvent.clientX - parentRect.left) / parentRect.width
          } else {
            ratio = (moveEvent.clientY - parentRect.top) / parentRect.height
          }
          ratio = Math.max(MIN_SPLIT_RATIO, Math.min(MAX_SPLIT_RATIO, ratio))
          onResize(ratio)
        }

        const handleMouseUp = () => {
          document.body.style.cursor = ''
          document.querySelectorAll('.terminal-view').forEach((el) => {
            ;(el as HTMLElement).style.pointerEvents = ''
          })
          document.removeEventListener('mousemove', handleMouseMove)
          document.removeEventListener('mouseup', handleMouseUp)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
      }
    },
    [direction, onResize, isTmux, onTmuxDividerResize]
  )

  return (
    <div
      ref={dividerRef}
      className={`split-divider split-divider--${direction}`}
      onMouseDown={handleMouseDown}
    />
  )
}
