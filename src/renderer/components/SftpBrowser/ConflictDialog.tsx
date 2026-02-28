import React from 'react'

interface ConflictDialogProps {
  filename: string
  onCancel: () => void
  onOverwrite: () => void
  onRename: () => void
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({
  filename,
  onCancel,
  onOverwrite,
  onRename
}) => {
  return (
    <div className="sftp-dialog-overlay">
      <div className="sftp-dialog">
        <div className="sftp-dialog__header">File Exists</div>
        <div className="sftp-dialog__body">
          <p>
            <strong>{filename}</strong> already exists at the destination.
          </p>
          <p>What would you like to do?</p>
        </div>
        <div className="sftp-dialog__actions">
          <button className="sftp-btn sftp-btn--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="sftp-btn sftp-btn--secondary" onClick={onRename}>
            Rename
          </button>
          <button className="sftp-btn sftp-btn--primary" onClick={onOverwrite}>
            Overwrite
          </button>
        </div>
      </div>
    </div>
  )
}
