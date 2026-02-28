import React, { useState, useEffect } from 'react'
import type { SshHostConfig, ConnectionConfig } from '@shared/sftp-types'

interface ConnectionDialogProps {
  onConnect: (config: ConnectionConfig) => void
  onClose: () => void
}

export const ConnectionDialog: React.FC<ConnectionDialogProps> = ({ onConnect, onClose }) => {
  const [hosts, setHosts] = useState<SshHostConfig[]>([])
  const [selectedHost, setSelectedHost] = useState<string>('')
  const [hostname, setHostname] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('')
  const [identityFile, setIdentityFile] = useState('')
  const [remotePath, setRemotePath] = useState('')

  useEffect(() => {
    window.sftpAPI.parseSshConfig().then(setHosts).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedHost) {
      const host = hosts.find((h) => h.host === selectedHost)
      if (host) {
        setHostname(host.hostname)
        setPort(String(host.port))
        setUsername(host.user)
        setIdentityFile(host.identityFile || '')
      }
    }
  }, [selectedHost, hosts])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!hostname) return
    onConnect({
      hostname,
      port: parseInt(port, 10) || 22,
      username: username || 'root',
      identityFile: identityFile || undefined,
      remotePath: remotePath || undefined
    })
  }

  return (
    <div className="sftp-dialog-overlay" onClick={onClose}>
      <div className="sftp-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="sftp-dialog__header">Connect to Server</div>
        <form onSubmit={handleSubmit} className="sftp-dialog__form">
          {hosts.length > 0 && (
            <div className="sftp-dialog__field">
              <label>SSH Config Host</label>
              <select
                value={selectedHost}
                onChange={(e) => setSelectedHost(e.target.value)}
              >
                <option value="">Custom...</option>
                {hosts.map((h) => (
                  <option key={h.host} value={h.host}>
                    {h.host} ({h.hostname})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="sftp-dialog__field">
            <label>Hostname</label>
            <input
              type="text"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="example.com"
              autoFocus
            />
          </div>
          <div className="sftp-dialog__row">
            <div className="sftp-dialog__field">
              <label>Port</label>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="22"
              />
            </div>
            <div className="sftp-dialog__field">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="root"
              />
            </div>
          </div>
          <div className="sftp-dialog__field">
            <label>SSH Key (optional)</label>
            <input
              type="text"
              value={identityFile}
              onChange={(e) => setIdentityFile(e.target.value)}
              placeholder="~/.ssh/id_rsa"
            />
          </div>
          <div className="sftp-dialog__field">
            <label>Remote Path (optional)</label>
            <input
              type="text"
              value={remotePath}
              onChange={(e) => setRemotePath(e.target.value)}
              placeholder="/"
            />
          </div>
          <div className="sftp-dialog__actions">
            <button type="button" className="sftp-btn sftp-btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="sftp-btn sftp-btn--primary" disabled={!hostname}>
              Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
