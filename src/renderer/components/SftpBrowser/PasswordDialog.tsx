import React, { useState, useRef, useEffect } from 'react'

interface PasswordDialogProps {
  onSubmit: (password: string) => void
  onCancel: () => void
}

export const PasswordDialog: React.FC<PasswordDialogProps> = ({ onSubmit, onCancel }) => {
  const [password, setPassword] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(password)
  }

  return (
    <div className="sftp-dialog-overlay">
      <div className="sftp-dialog">
        <div className="sftp-dialog__header">Password Required</div>
        <form onSubmit={handleSubmit} className="sftp-dialog__form">
          <div className="sftp-dialog__field">
            <label>Password</label>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>
          <div className="sftp-dialog__actions">
            <button type="button" className="sftp-btn sftp-btn--secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="sftp-btn sftp-btn--primary">
              Authenticate
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
