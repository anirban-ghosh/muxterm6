import React, { useCallback, useRef } from 'react'
import type { SplitDirection } from '../../../shared/types'
import { MIN_SPLIT_RATIO, MAX_SPLIT_RATIO } from '../../../shared/constants'

interface SplitDividerProps {
  direction: SplitDirection
  onResize: (ratio: number) => void
}

export const SplitDivider: React.FC<SplitDividerProps> = ({ direction, onResize }) => {
  const dividerRef = useRef<HTMLDivElement>(null)

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
    },
    [direction, onResize]
  )

  return (
    <div
      ref={dividerRef}
      className={`split-divider split-divider--${direction}`}
      onMouseDown={handleMouseDown}
    />
  )
}
