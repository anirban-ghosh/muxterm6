import React, { useCallback } from 'react'

interface TabProps {
  id: string
  title: string
  isActive: boolean
  onActivate: (id: string) => void
  onClose: (id: string) => void
  index: number
  onDragStart: (index: number) => void
  onDragOver: (index: number) => void
  onDragEnd: () => void
}

export const Tab: React.FC<TabProps> = ({
  id,
  title,
  isActive,
  onActivate,
  onClose,
  index,
  onDragStart,
  onDragOver,
  onDragEnd
}) => {
  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClose(id)
    },
    [id, onClose]
  )

  return (
    <div
      className={`tab ${isActive ? 'tab--active' : ''}`}
      onClick={() => onActivate(id)}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver(index)
      }}
      onDragEnd={onDragEnd}
    >
      <span className="tab__title">{title}</span>
      <button className="tab__close" onClick={handleClose}>
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
