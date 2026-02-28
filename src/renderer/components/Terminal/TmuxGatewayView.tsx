import React, { useEffect, useCallback } from 'react'

interface TmuxGatewayViewProps {
  ptyId: string
  sessionName: string
  onDetach: () => void
  onForceQuit: () => void
}

export const TmuxGatewayView: React.FC<TmuxGatewayViewProps> = ({
  ptyId,
  sessionName,
  onDetach,
  onForceQuit
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onDetach()
      }
      if (e.key === 'x' || e.key === 'X') {
        e.preventDefault()
        onForceQuit()
      }
    },
    [onDetach, onForceQuit]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="tmux-gateway">
      <div className="tmux-gateway__content">
        <div className="tmux-gateway__icon">tmux</div>
        <div className="tmux-gateway__title">Tmux Control Mode</div>
        <div className="tmux-gateway__session">
          Session: <strong>{sessionName}</strong>
        </div>
        <div className="tmux-gateway__info">
          A new window has been opened for this tmux session.
        </div>
        <div className="tmux-gateway__actions">
          <div className="tmux-gateway__key">
            <kbd>Esc</kbd> Detach
          </div>
          <div className="tmux-gateway__key">
            <kbd>X</kbd> Force Quit
          </div>
        </div>
      </div>
    </div>
  )
}
