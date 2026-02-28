import React from 'react'
import { useSftpStore } from '../../store/sftp'

interface ConnectionBarProps {
  onConnect: () => void
  onDisconnect: () => void
}

export const ConnectionBar: React.FC<ConnectionBarProps> = ({ onConnect, onDisconnect }) => {
  const connected = useSftpStore((s) => s.connected)
  const connecting = useSftpStore((s) => s.connecting)
  const connectionConfig = useSftpStore((s) => s.connectionConfig)
  const connectionError = useSftpStore((s) => s.connectionError)

  return (
    <div className="sftp-connection-bar">
      <div className="sftp-connection-bar__status">
        <span
          className={`sftp-connection-bar__dot sftp-connection-bar__dot--${connected ? 'connected' : 'disconnected'}`}
        />
        {connected && connectionConfig ? (
          <span>
            {connectionConfig.username}@{connectionConfig.hostname}:{connectionConfig.port}
          </span>
        ) : connecting ? (
          <span>Connecting...</span>
        ) : connectionError ? (
          <span className="sftp-connection-bar__error">{connectionError}</span>
        ) : (
          <span>Not connected</span>
        )}
      </div>
      <div className="sftp-connection-bar__actions">
        {connected ? (
          <button className="sftp-btn sftp-btn--small" onClick={onDisconnect}>
            Disconnect
          </button>
        ) : (
          <button
            className="sftp-btn sftp-btn--small sftp-btn--primary"
            onClick={onConnect}
            disabled={connecting}
          >
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </div>
    </div>
  )
}
