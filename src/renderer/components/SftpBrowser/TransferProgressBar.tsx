import React from 'react'
import type { TransferProgress } from '@shared/sftp-types'

interface TransferProgressBarProps {
  transfers: Map<string, TransferProgress>
  onCancel: (transferId: string) => void
}

export const TransferProgressBar: React.FC<TransferProgressBarProps> = ({
  transfers,
  onCancel
}) => {
  if (transfers.size === 0) return null

  return (
    <div className="sftp-transfers">
      {Array.from(transfers.values()).map((t) => (
        <div key={t.transferId} className="sftp-transfer">
          <span className="sftp-transfer__name">{t.filename}</span>
          <div className="sftp-transfer__bar">
            <div
              className="sftp-transfer__fill"
              style={{ width: `${t.percentage}%` }}
            />
          </div>
          <span className="sftp-transfer__pct">{t.percentage}%</span>
          {t.speed && <span className="sftp-transfer__speed">{t.speed}</span>}
          <button
            className="sftp-transfer__cancel"
            onClick={() => onCancel(t.transferId)}
            title="Cancel"
          >
            x
          </button>
        </div>
      ))}
    </div>
  )
}
