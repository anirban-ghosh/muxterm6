import React from 'react'
import type { TunnelInfo } from '@shared/tunnel-types'

interface TunnelTableProps {
  tunnels: TunnelInfo[]
  onPause: (id: string) => void
  onResume: (id: string) => void
  onDestroy: (id: string) => void
}

const typeLabels = { local: 'L', remote: 'R', dynamic: 'D' } as const

export const TunnelTable: React.FC<TunnelTableProps> = ({
  tunnels,
  onPause,
  onResume,
  onDestroy
}) => {
  if (tunnels.length === 0) {
    return (
      <div className="tunnel-empty">
        No active tunnels. Click "Add Tunnel" to create one.
      </div>
    )
  }

  return (
    <div className="tunnel-table">
      <div className="tunnel-table__header">
        <span className="tunnel-table__col tunnel-table__col--type">Type</span>
        <span className="tunnel-table__col tunnel-table__col--host">Host</span>
        <span className="tunnel-table__col tunnel-table__col--sshport">SSH Port</span>
        <span className="tunnel-table__col tunnel-table__col--localport">Local Port</span>
        <span className="tunnel-table__col tunnel-table__col--remote">Remote</span>
        <span className="tunnel-table__col tunnel-table__col--status">Status</span>
        <span className="tunnel-table__col tunnel-table__col--conns">Conns</span>
        <span className="tunnel-table__col tunnel-table__col--actions">Actions</span>
      </div>
      {tunnels.map((t) => (
        <div key={t.id} className="tunnel-table__row">
          <span className="tunnel-table__col tunnel-table__col--type">
            <span className={`tunnel-type-badge tunnel-type-badge--${t.config.type}`}>
              {typeLabels[t.config.type]}
            </span>
          </span>
          <span className="tunnel-table__col tunnel-table__col--host" title={t.config.hostname}>
            {t.config.hostname}
          </span>
          <span className="tunnel-table__col tunnel-table__col--sshport">
            {t.config.port}
          </span>
          <span className="tunnel-table__col tunnel-table__col--localport">
            {t.config.localPort}
          </span>
          <span className="tunnel-table__col tunnel-table__col--remote">
            {t.config.type === 'dynamic'
              ? '*'
              : `${t.config.remoteHost}:${t.config.remotePort}`}
          </span>
          <span className="tunnel-table__col tunnel-table__col--status">
            <span className={`tunnel-status tunnel-status--${t.status}`}>
              {t.status}
            </span>
          </span>
          <span className="tunnel-table__col tunnel-table__col--conns">
            {t.activeConnections}
          </span>
          <span className="tunnel-table__col tunnel-table__col--actions">
            {t.status === 'active' && (
              <button
                className="tunnel-action-btn"
                onClick={() => onPause(t.id)}
                title="Pause tunnel"
              >
                Pause
              </button>
            )}
            {t.status === 'paused' && (
              <button
                className="tunnel-action-btn"
                onClick={() => onResume(t.id)}
                title="Resume tunnel"
              >
                Resume
              </button>
            )}
            <button
              className="tunnel-action-btn tunnel-action-btn--danger"
              onClick={() => onDestroy(t.id)}
              title="Destroy tunnel"
            >
              Destroy
            </button>
          </span>
        </div>
      ))}
    </div>
  )
}
