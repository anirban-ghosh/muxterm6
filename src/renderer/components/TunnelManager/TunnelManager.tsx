import React, { useEffect, useCallback } from 'react'
import { useTunnelStore } from '../../store/tunnel'
import { TitleBar } from '../TitleBar/TitleBar'
import { TunnelTable } from './TunnelTable'
import { AddTunnelDialog } from './AddTunnelDialog'
import { HostKeyDialog } from '../SftpBrowser/HostKeyDialog'
import { PasswordDialog } from '../SftpBrowser/PasswordDialog'
import type { TunnelConfig, TunnelInfo } from '@shared/tunnel-types'
import type { HostKeyInfo } from '@shared/sftp-types'

export const TunnelManager: React.FC = () => {
  const store = useTunnelStore()

  // Hydrate tunnel list on mount
  useEffect(() => {
    window.tunnelAPI.listTunnels().then((tunnels) => {
      useTunnelStore.getState().setTunnels(tunnels)
    })
  }, [])

  // Listen for status updates
  useEffect(() => {
    const off = window.tunnelAPI.onStatusUpdate((info: TunnelInfo) => {
      useTunnelStore.getState().updateTunnel(info)
    })
    return off
  }, [])

  // Listen for auth dialogs
  useEffect(() => {
    const offHostKey = window.tunnelAPI.onHostKeyVerify((info: HostKeyInfo) => {
      useTunnelStore.getState().setHostKeyInfo(info)
    })
    const offPassword = window.tunnelAPI.onPasswordPrompt(() => {
      useTunnelStore.getState().setShowPasswordDialog(true)
    })
    return () => {
      offHostKey()
      offPassword()
    }
  }, [])

  const handleAdd = useCallback(async (config: TunnelConfig) => {
    useTunnelStore.getState().setShowAddDialog(false)
    useTunnelStore.getState().setLoading(true)
    try {
      await window.tunnelAPI.createTunnel(config)
    } catch (err) {
      console.error('Failed to create tunnel:', err)
    } finally {
      useTunnelStore.getState().setLoading(false)
      // Refresh list
      const tunnels = await window.tunnelAPI.listTunnels()
      useTunnelStore.getState().setTunnels(tunnels)
    }
  }, [])

  const handlePause = useCallback(async (id: string) => {
    await window.tunnelAPI.pauseTunnel(id)
  }, [])

  const handleResume = useCallback(async (id: string) => {
    await window.tunnelAPI.resumeTunnel(id)
  }, [])

  const handleDestroy = useCallback(async (id: string) => {
    await window.tunnelAPI.destroyTunnel(id)
    useTunnelStore.getState().removeTunnel(id)
  }, [])

  return (
    <div className="tunnel-app">
      <TitleBar>
        <div className="sftp-title">Port Forwarding</div>
      </TitleBar>
      <div className="tunnel-toolbar">
        <button
          className="sftp-btn sftp-btn--primary sftp-btn--small"
          onClick={() => store.setShowAddDialog(true)}
          disabled={store.loading}
        >
          {store.loading ? 'Connecting...' : 'Add Tunnel'}
        </button>
      </div>
      <div className="tunnel-content">
        <TunnelTable
          tunnels={store.tunnels}
          onPause={handlePause}
          onResume={handleResume}
          onDestroy={handleDestroy}
        />
      </div>

      {/* Dialogs */}
      {store.showAddDialog && (
        <AddTunnelDialog
          onAdd={handleAdd}
          onClose={() => store.setShowAddDialog(false)}
        />
      )}
      {store.hostKeyInfo && (
        <HostKeyDialog
          info={store.hostKeyInfo}
          onAccept={() => {
            window.tunnelAPI.respondHostKey(true)
            store.setHostKeyInfo(null)
          }}
          onReject={() => {
            window.tunnelAPI.respondHostKey(false)
            store.setHostKeyInfo(null)
          }}
        />
      )}
      {store.showPasswordDialog && (
        <PasswordDialog
          onSubmit={(password) => {
            window.tunnelAPI.respondPassword(password)
            store.setShowPasswordDialog(false)
          }}
          onCancel={() => {
            window.tunnelAPI.respondPassword('')
            store.setShowPasswordDialog(false)
          }}
        />
      )}
    </div>
  )
}
