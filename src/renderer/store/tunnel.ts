import { create } from 'zustand'
import type { TunnelInfo } from '@shared/tunnel-types'
import type { HostKeyInfo } from '@shared/sftp-types'

interface TunnelState {
  tunnels: TunnelInfo[]
  showAddDialog: boolean
  hostKeyInfo: HostKeyInfo | null
  showPasswordDialog: boolean
  loading: boolean

  setTunnels: (tunnels: TunnelInfo[]) => void
  updateTunnel: (info: TunnelInfo) => void
  removeTunnel: (id: string) => void
  setShowAddDialog: (show: boolean) => void
  setHostKeyInfo: (info: HostKeyInfo | null) => void
  setShowPasswordDialog: (show: boolean) => void
  setLoading: (loading: boolean) => void
}

export const useTunnelStore = create<TunnelState>()((set) => ({
  tunnels: [],
  showAddDialog: false,
  hostKeyInfo: null,
  showPasswordDialog: false,
  loading: false,

  setTunnels: (tunnels) => set({ tunnels }),

  updateTunnel: (info) =>
    set((state) => {
      const idx = state.tunnels.findIndex((t) => t.id === info.id)
      if (idx >= 0) {
        const tunnels = [...state.tunnels]
        tunnels[idx] = info
        return { tunnels }
      }
      return { tunnels: [...state.tunnels, info] }
    }),

  removeTunnel: (id) =>
    set((state) => ({
      tunnels: state.tunnels.filter((t) => t.id !== id)
    })),

  setShowAddDialog: (showAddDialog) => set({ showAddDialog }),
  setHostKeyInfo: (hostKeyInfo) => set({ hostKeyInfo }),
  setShowPasswordDialog: (showPasswordDialog) => set({ showPasswordDialog }),
  setLoading: (loading) => set({ loading })
}))
