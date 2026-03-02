import React, { useState, useEffect, useCallback } from 'react'
import { TunnelDiagram } from './TunnelDiagram'
import type { TunnelType, TunnelConfig } from '@shared/tunnel-types'
import type { SshHostConfig } from '@shared/sftp-types'

interface AddTunnelDialogProps {
  onAdd: (config: TunnelConfig) => void
  onClose: () => void
}

export const AddTunnelDialog: React.FC<AddTunnelDialogProps> = ({ onAdd, onClose }) => {
  const [sshHosts, setSshHosts] = useState<SshHostConfig[]>([])
  const [selectedHost, setSelectedHost] = useState('')
  const [hostname, setHostname] = useState('')
  const [sshPort, setSshPort] = useState('22')
  const [username, setUsername] = useState('')
  const [identityFile, setIdentityFile] = useState('')
  const [tunnelType, setTunnelType] = useState<TunnelType>('local')
  const [localPort, setLocalPort] = useState('')
  const [remoteHost, setRemoteHost] = useState('localhost')
  const [remotePort, setRemotePort] = useState('')

  useEffect(() => {
    window.tunnelAPI.parseSshConfig().then(setSshHosts)
  }, [])

  const handleHostSelect = useCallback(
    (hostName: string) => {
      setSelectedHost(hostName)
      const host = sshHosts.find((h) => h.host === hostName)
      if (host) {
        setHostname(host.hostname)
        setSshPort(String(host.port))
        setUsername(host.user)
        setIdentityFile(host.identityFile || '')
      }
    },
    [sshHosts]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const config: TunnelConfig = {
      type: tunnelType,
      hostname,
      port: parseInt(sshPort, 10) || 22,
      username,
      identityFile: identityFile || undefined,
      localPort: parseInt(localPort, 10),
      remoteHost: tunnelType === 'dynamic' ? '' : remoteHost,
      remotePort: tunnelType === 'dynamic' ? 0 : parseInt(remotePort, 10)
    }
    onAdd(config)
  }

  const isValid =
    hostname &&
    username &&
    localPort &&
    (tunnelType === 'dynamic' || (remoteHost && remotePort))

  return (
    <div className="sftp-dialog-overlay">
      <div className="sftp-dialog" style={{ minWidth: 480 }}>
        <div className="sftp-dialog__header">Add Tunnel</div>
        <form onSubmit={handleSubmit} className="sftp-dialog__form">
          {/* SSH Host selection */}
          {sshHosts.length > 0 && (
            <div className="sftp-dialog__field">
              <label>SSH Config Host</label>
              <select
                value={selectedHost}
                onChange={(e) => handleHostSelect(e.target.value)}
              >
                <option value="">Custom...</option>
                {sshHosts.map((h) => (
                  <option key={h.host} value={h.host}>
                    {h.host} ({h.hostname})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Connection fields */}
          <div className="sftp-dialog__row">
            <div className="sftp-dialog__field">
              <label>Hostname</label>
              <input
                type="text"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="example.com"
              />
            </div>
            <div className="sftp-dialog__field" style={{ maxWidth: 80 }}>
              <label>SSH Port</label>
              <input
                type="text"
                value={sshPort}
                onChange={(e) => setSshPort(e.target.value)}
              />
            </div>
          </div>

          <div className="sftp-dialog__row">
            <div className="sftp-dialog__field">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="user"
              />
            </div>
            <div className="sftp-dialog__field">
              <label>Identity File (optional)</label>
              <input
                type="text"
                value={identityFile}
                onChange={(e) => setIdentityFile(e.target.value)}
                placeholder="~/.ssh/id_rsa"
              />
            </div>
          </div>

          {/* Tunnel type toggle */}
          <div className="sftp-dialog__field">
            <label>Tunnel Type</label>
            <div className="tunnel-type-toggle">
              {(['local', 'remote', 'dynamic'] as TunnelType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`tunnel-type-toggle__btn ${tunnelType === t ? 'tunnel-type-toggle__btn--active' : ''}`}
                  onClick={() => setTunnelType(t)}
                >
                  {t === 'local' ? 'Local (-L)' : t === 'remote' ? 'Remote (-R)' : 'Dynamic (-D)'}
                </button>
              ))}
            </div>
          </div>

          {/* Port configuration */}
          <div className="sftp-dialog__row">
            <div className="sftp-dialog__field" style={{ maxWidth: 120 }}>
              <label>Local Port</label>
              <input
                type="text"
                value={localPort}
                onChange={(e) => setLocalPort(e.target.value)}
                placeholder="8080"
              />
            </div>
            {tunnelType !== 'dynamic' && (
              <>
                <div className="sftp-dialog__field">
                  <label>Remote Host</label>
                  <input
                    type="text"
                    value={remoteHost}
                    onChange={(e) => setRemoteHost(e.target.value)}
                    placeholder="localhost"
                  />
                </div>
                <div className="sftp-dialog__field" style={{ maxWidth: 120 }}>
                  <label>Remote Port</label>
                  <input
                    type="text"
                    value={remotePort}
                    onChange={(e) => setRemotePort(e.target.value)}
                    placeholder="3306"
                  />
                </div>
              </>
            )}
          </div>

          {/* Visual diagram */}
          <TunnelDiagram
            type={tunnelType}
            localPort={localPort}
            remoteHost={remoteHost}
            remotePort={remotePort}
            sshHost={hostname}
          />

          <div className="sftp-dialog__actions">
            <button type="button" className="sftp-btn sftp-btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="sftp-btn sftp-btn--primary" disabled={!isValid}>
              Start Tunnel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
