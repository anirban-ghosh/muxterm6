import React from 'react'
import type { HostKeyInfo } from '@shared/sftp-types'

interface HostKeyDialogProps {
  info: HostKeyInfo
  onAccept: () => void
  onReject: () => void
}

export const HostKeyDialog: React.FC<HostKeyDialogProps> = ({ info, onAccept, onReject }) => {
  return (
    <div className="sftp-dialog-overlay">
      <div className="sftp-dialog">
        <div className="sftp-dialog__header">Host Key Verification</div>
        <div className="sftp-dialog__body">
          <p>The authenticity of host <strong>{info.hostname}</strong> cannot be established.</p>
          <p className="sftp-dialog__fingerprint">
            <code>{info.fingerprint}</code>
          </p>
          <p>Are you sure you want to continue connecting?</p>
        </div>
        <div className="sftp-dialog__actions">
          <button className="sftp-btn sftp-btn--secondary" onClick={onReject}>
            Reject
          </button>
          <button className="sftp-btn sftp-btn--primary" onClick={onAccept}>
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
