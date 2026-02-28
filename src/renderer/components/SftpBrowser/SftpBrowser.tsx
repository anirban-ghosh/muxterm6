import React, { useEffect, useCallback, useRef } from 'react'
import { useSftpStore } from '../../store/sftp'
import { TitleBar } from '../TitleBar/TitleBar'
import { ConnectionBar } from './ConnectionBar'
import { ConnectionDialog } from './ConnectionDialog'
import { AddressBar } from './AddressBar'
import { FileBrowser } from './FileBrowser'
import { HostKeyDialog } from './HostKeyDialog'
import { PasswordDialog } from './PasswordDialog'
import { ConflictDialog } from './ConflictDialog'
import { TransferProgressBar } from './TransferProgressBar'
import type { FileEntry, ConnectionConfig, TransferProgress, HostKeyInfo } from '@shared/sftp-types'

let transferCounter = 0
function nextTransferId(): string {
  return `transfer-${++transferCounter}-${Date.now()}`
}

export const SftpBrowser: React.FC = () => {
  const store = useSftpStore()
  const dragSourceRef = useRef<{ entries: FileEntry[]; side: 'local' | 'remote' } | null>(null)
  const mountedRef = useRef(false)

  // Initialize local path on mount
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    window.sftpAPI.localHome().then((home) => {
      store.setLocalPath(home)
      loadLocalFiles(home)
    })
  }, [])

  // Listen for transfer events
  useEffect(() => {
    const offProgress = window.sftpAPI.onTransferProgress((progress: TransferProgress) => {
      useSftpStore.getState().updateTransfer(progress)
    })
    const offComplete = window.sftpAPI.onTransferComplete((transferId: string) => {
      useSftpStore.getState().removeTransfer(transferId)
      // Refresh both panes
      const s = useSftpStore.getState()
      loadLocalFiles(s.localPath)
      if (s.connected) loadRemoteFiles(s.remotePath)
    })
    const offError = window.sftpAPI.onTransferError((transferId: string, error: string) => {
      useSftpStore.getState().removeTransfer(transferId)
      console.error('Transfer error:', error)
    })
    return () => {
      offProgress()
      offComplete()
      offError()
    }
  }, [])

  // Listen for auth dialogs
  useEffect(() => {
    const offHostKey = window.sftpAPI.onHostKeyVerify((info: HostKeyInfo) => {
      useSftpStore.getState().setHostKeyInfo(info)
    })
    const offPassword = window.sftpAPI.onPasswordPrompt(() => {
      useSftpStore.getState().setShowPasswordDialog(true)
    })
    return () => {
      offHostKey()
      offPassword()
    }
  }, [])

  const loadLocalFiles = useCallback(async (path: string) => {
    useSftpStore.getState().setLocalLoading(true)
    try {
      const files = await window.sftpAPI.localList(path)
      const s = useSftpStore.getState()
      // Only update if path hasn't changed
      if (s.localPath === path || !mountedRef.current) {
        s.setLocalFiles(files)
      }
    } catch (err) {
      console.error('Failed to list local files:', err)
    } finally {
      useSftpStore.getState().setLocalLoading(false)
    }
  }, [])

  const loadRemoteFiles = useCallback(async (path: string) => {
    useSftpStore.getState().setRemoteLoading(true)
    try {
      const files = await window.sftpAPI.remoteList(path)
      const s = useSftpStore.getState()
      if (s.remotePath === path) {
        s.setRemoteFiles(files)
      }
    } catch (err) {
      console.error('Failed to list remote files:', err)
    } finally {
      useSftpStore.getState().setRemoteLoading(false)
    }
  }, [])

  const handleLocalNavigate = useCallback(
    (path: string) => {
      store.setLocalPath(path)
      store.setLocalSelection(new Set())
      loadLocalFiles(path)
    },
    [store, loadLocalFiles]
  )

  const handleRemoteNavigate = useCallback(
    (path: string) => {
      store.setRemotePath(path)
      store.setRemoteSelection(new Set())
      loadRemoteFiles(path)
    },
    [store, loadRemoteFiles]
  )

  const handleConnect = useCallback(
    async (config: ConnectionConfig) => {
      store.setShowConnectionDialog(false)
      store.setConnecting(true)
      store.setConnectionError(null)
      store.setConnectionConfig(config)
      try {
        await window.sftpAPI.connect(config)
        store.setConnected(true)
        store.setConnecting(false)
        // Get remote home and list
        const home = config.remotePath || (await window.sftpAPI.remoteHome())
        store.setRemotePath(home)
        loadRemoteFiles(home)
      } catch (err) {
        store.setConnecting(false)
        store.setConnected(false)
        store.setConnectionError(err instanceof Error ? err.message : String(err))
      }
    },
    [store, loadRemoteFiles]
  )

  const handleDisconnect = useCallback(async () => {
    try {
      await window.sftpAPI.disconnect()
    } catch {
      // Ignore
    }
    store.setConnected(false)
    store.setConnectionConfig(null)
    store.setRemotePath('')
    store.setRemoteFiles([])
  }, [store])

  const handleLocalDoubleClick = useCallback((entry: FileEntry) => {
    if (!entry.isDirectory) {
      window.sftpAPI.localOpenFile(entry.path)
    }
  }, [])

  const handleRemoteDoubleClick = useCallback(
    (entry: FileEntry) => {
      if (!entry.isDirectory) {
        // Download remote file to local current directory
        const s = useSftpStore.getState()
        const filename = entry.name
        const destPath = s.localPath + '/' + filename
        const transferId = nextTransferId()
        window.sftpAPI.transferStart({
          transferId,
          sourcePath: entry.path,
          destPath,
          direction: 'download',
          isDirectory: false
        })
      }
    },
    []
  )

  const handleDragStart = useCallback(
    (entries: FileEntry[], side: 'local' | 'remote') => {
      dragSourceRef.current = { entries, side }
    },
    []
  )

  const handleLocalDrop = useCallback(
    async (targetPath: string) => {
      const source = dragSourceRef.current
      dragSourceRef.current = null
      if (!source) return

      const s = useSftpStore.getState()

      if (source.side === 'local') {
        // Intra-pane move
        for (const entry of source.entries) {
          const dest = targetPath + '/' + entry.name
          try {
            await window.sftpAPI.localRename(entry.path, dest)
          } catch (err) {
            console.error('Move failed:', err)
          }
        }
        loadLocalFiles(s.localPath)
      } else {
        // Remote -> Local transfer
        for (const entry of source.entries) {
          const transferId = nextTransferId()
          const destPath = targetPath + '/' + entry.name
          await window.sftpAPI.transferStart({
            transferId,
            sourcePath: entry.path,
            destPath,
            direction: 'download',
            isDirectory: entry.isDirectory
          })
        }
      }
    },
    [loadLocalFiles]
  )

  const handleRemoteDrop = useCallback(
    async (targetPath: string) => {
      const source = dragSourceRef.current
      dragSourceRef.current = null
      if (!source) return

      const s = useSftpStore.getState()

      if (source.side === 'remote') {
        // Intra-pane move
        for (const entry of source.entries) {
          const dest = targetPath + '/' + entry.name
          try {
            await window.sftpAPI.remoteRename(entry.path, dest)
          } catch (err) {
            console.error('Move failed:', err)
          }
        }
        loadRemoteFiles(s.remotePath)
      } else {
        // Local -> Remote transfer
        for (const entry of source.entries) {
          const transferId = nextTransferId()
          const destPath = targetPath + '/' + entry.name
          await window.sftpAPI.transferStart({
            transferId,
            sourcePath: entry.path,
            destPath,
            direction: 'upload',
            isDirectory: entry.isDirectory
          })
        }
      }
    },
    [loadRemoteFiles]
  )

  // Context menu handlers
  const handleContextCut = useCallback(
    (side: 'local' | 'remote') => {
      const s = useSftpStore.getState()
      const sel = side === 'local' ? s.localSelection : s.remoteSelection
      const files = side === 'local' ? s.localFiles : s.remoteFiles
      const selected = files.filter((f) => sel.has(f.path))
      if (selected.length === 0) return
      s.setClipboard({ files: selected, operation: 'cut', source: side })
    },
    []
  )

  const handleContextCopy = useCallback(
    (side: 'local' | 'remote') => {
      const s = useSftpStore.getState()
      const sel = side === 'local' ? s.localSelection : s.remoteSelection
      const files = side === 'local' ? s.localFiles : s.remoteFiles
      const selected = files.filter((f) => sel.has(f.path))
      if (selected.length === 0) return
      s.setClipboard({ files: selected, operation: 'copy', source: side })
    },
    []
  )

  const handleContextPaste = useCallback(
    (targetSide: 'local' | 'remote') => {
      const s = useSftpStore.getState()
      if (!s.clipboard) return

      const targetPath = targetSide === 'local' ? s.localPath : s.remotePath
      const { files, operation, source } = s.clipboard

      for (const entry of files) {
        const destPath = targetPath + '/' + entry.name

        if (source === targetSide) {
          if (targetSide === 'local') {
            if (operation === 'cut') {
              window.sftpAPI.localRename(entry.path, destPath)
            } else {
              window.sftpAPI.localCopy(entry.path, destPath)
            }
          } else {
            if (operation === 'cut') {
              window.sftpAPI.remoteRename(entry.path, destPath)
            }
          }
        } else {
          const transferId = nextTransferId()
          window.sftpAPI.transferStart({
            transferId,
            sourcePath: entry.path,
            destPath,
            direction: source === 'local' ? 'upload' : 'download',
            isDirectory: entry.isDirectory
          })
        }
      }

      if (operation === 'cut') {
        s.setClipboard(null)
      }
    },
    []
  )

  const handleContextDelete = useCallback(
    async (side: 'local' | 'remote') => {
      const s = useSftpStore.getState()
      const sel = side === 'local' ? s.localSelection : s.remoteSelection
      const files = side === 'local' ? s.localFiles : s.remoteFiles
      const selected = files.filter((f) => sel.has(f.path))
      if (selected.length === 0) return

      for (const entry of selected) {
        try {
          if (side === 'local') {
            await window.sftpAPI.localDelete(entry.path, entry.isDirectory)
          } else {
            await window.sftpAPI.remoteDelete(entry.path, entry.isDirectory)
          }
        } catch (err) {
          console.error('Delete failed:', err)
        }
      }

      // Refresh and clear selection
      if (side === 'local') {
        s.setLocalSelection(new Set())
        loadLocalFiles(s.localPath)
      } else {
        s.setRemoteSelection(new Set())
        loadRemoteFiles(s.remotePath)
      }
    },
    [loadLocalFiles, loadRemoteFiles]
  )

  const handleContextSendTo = useCallback(
    (side: 'local' | 'remote') => {
      const s = useSftpStore.getState()
      const sel = side === 'local' ? s.localSelection : s.remoteSelection
      const files = side === 'local' ? s.localFiles : s.remoteFiles
      const selected = files.filter((f) => sel.has(f.path))
      if (selected.length === 0) return

      const targetPath = side === 'local' ? s.remotePath : s.localPath
      const direction = side === 'local' ? 'upload' : 'download'

      for (const entry of selected) {
        const transferId = nextTransferId()
        const destPath = targetPath + '/' + entry.name
        window.sftpAPI.transferStart({
          transferId,
          sourcePath: entry.path,
          destPath,
          direction,
          isDirectory: entry.isDirectory
        })
      }
    },
    []
  )

  // Clipboard and delete keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      const s = useSftpStore.getState()

      // Delete / Backspace (with or without Cmd)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only handle when focused inside a pane (not in an input)
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return

        const active = document.activeElement?.closest('.sftp-pane')
        if (!active) return

        const side = active.getAttribute('data-side') as 'local' | 'remote' | null
        if (!side) return

        handleContextDelete(side)
        e.preventDefault()
        return
      }

      if (!meta) return

      if (e.key === 'c' || e.key === 'x') {
        const active = document.activeElement?.closest('.sftp-pane')
        if (!active) return

        const side = active.getAttribute('data-side') as 'local' | 'remote' | null
        if (!side) return

        const selection = side === 'local' ? s.localSelection : s.remoteSelection
        const files = side === 'local' ? s.localFiles : s.remoteFiles
        const selected = files.filter((f) => selection.has(f.path))
        if (selected.length === 0) return

        s.setClipboard({
          files: selected,
          operation: e.key === 'x' ? 'cut' : 'copy',
          source: side
        })
        e.preventDefault()
      }

      if (e.key === 'v' && s.clipboard) {
        const active = document.activeElement?.closest('.sftp-pane')
        if (!active) return

        const targetSide = active.getAttribute('data-side') as 'local' | 'remote' | null
        if (!targetSide) return

        const targetPath = targetSide === 'local' ? s.localPath : s.remotePath
        const { files, operation, source } = s.clipboard

        for (const entry of files) {
          const destPath = targetPath + '/' + entry.name

          if (source === targetSide) {
            if (targetSide === 'local') {
              if (operation === 'cut') {
                window.sftpAPI.localRename(entry.path, destPath)
              } else {
                window.sftpAPI.localCopy(entry.path, destPath)
              }
            } else {
              if (operation === 'cut') {
                window.sftpAPI.remoteRename(entry.path, destPath)
              }
            }
          } else {
            const transferId = nextTransferId()
            window.sftpAPI.transferStart({
              transferId,
              sourcePath: entry.path,
              destPath,
              direction: source === 'local' ? 'upload' : 'download',
              isDirectory: entry.isDirectory
            })
          }
        }

        if (operation === 'cut') {
          s.setClipboard(null)
        }
        e.preventDefault()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleContextDelete])

  const handleTransferCancel = useCallback((transferId: string) => {
    window.sftpAPI.transferCancel(transferId)
    useSftpStore.getState().removeTransfer(transferId)
  }, [])

  return (
    <div className="sftp-app">
      <TitleBar>
        <div className="sftp-title">SFTP Browser</div>
      </TitleBar>
      <ConnectionBar
        onConnect={() => store.setShowConnectionDialog(true)}
        onDisconnect={handleDisconnect}
      />
      <div className="sftp-panes">
        <div className="sftp-pane" data-side="local">
          <AddressBar path={store.localPath} onNavigate={handleLocalNavigate} label="Local" />
          <FileBrowser
            files={store.localFiles}
            loading={store.localLoading}
            selection={store.localSelection}
            onSelectionChange={store.setLocalSelection}
            onNavigate={handleLocalNavigate}
            onDoubleClick={handleLocalDoubleClick}
            onDragStart={handleDragStart}
            onDrop={handleLocalDrop}
            side="local"
            currentPath={store.localPath}
            onContextCut={() => handleContextCut('local')}
            onContextCopy={() => handleContextCopy('local')}
            onContextPaste={() => handleContextPaste('local')}
            onContextDelete={() => handleContextDelete('local')}
            onContextSendTo={() => handleContextSendTo('local')}
            clipboardHasContent={store.clipboard !== null}
            connected={store.connected}
          />
        </div>
        <div className="sftp-divider" />
        <div className="sftp-pane" data-side="remote">
          <AddressBar path={store.remotePath} onNavigate={handleRemoteNavigate} label="Remote" />
          <FileBrowser
            files={store.remoteFiles}
            loading={store.remoteLoading}
            selection={store.remoteSelection}
            onSelectionChange={store.setRemoteSelection}
            onNavigate={handleRemoteNavigate}
            onDoubleClick={handleRemoteDoubleClick}
            onDragStart={handleDragStart}
            onDrop={handleRemoteDrop}
            side="remote"
            currentPath={store.remotePath}
            onContextCut={() => handleContextCut('remote')}
            onContextCopy={() => handleContextCopy('remote')}
            onContextPaste={() => handleContextPaste('remote')}
            onContextDelete={() => handleContextDelete('remote')}
            onContextSendTo={() => handleContextSendTo('remote')}
            clipboardHasContent={store.clipboard !== null}
            connected={store.connected}
          />
        </div>
      </div>
      <TransferProgressBar transfers={store.transfers} onCancel={handleTransferCancel} />

      {/* Dialogs */}
      {store.showConnectionDialog && (
        <ConnectionDialog
          onConnect={handleConnect}
          onClose={() => store.setShowConnectionDialog(false)}
        />
      )}
      {store.hostKeyInfo && (
        <HostKeyDialog
          info={store.hostKeyInfo}
          onAccept={() => {
            window.sftpAPI.respondHostKey(true)
            store.setHostKeyInfo(null)
          }}
          onReject={() => {
            window.sftpAPI.respondHostKey(false)
            store.setHostKeyInfo(null)
          }}
        />
      )}
      {store.showPasswordDialog && (
        <PasswordDialog
          onSubmit={(password) => {
            window.sftpAPI.respondPassword(password)
            store.setShowPasswordDialog(false)
          }}
          onCancel={() => {
            window.sftpAPI.respondPassword('')
            store.setShowPasswordDialog(false)
          }}
        />
      )}
      {store.conflictInfo && (
        <ConflictDialog
          filename={store.conflictInfo.filename}
          onCancel={() => {
            store.conflictInfo?.resolve('cancel')
            store.setConflictInfo(null)
          }}
          onOverwrite={() => {
            store.conflictInfo?.resolve('overwrite')
            store.setConflictInfo(null)
          }}
          onRename={() => {
            store.conflictInfo?.resolve('rename')
            store.setConflictInfo(null)
          }}
        />
      )}
    </div>
  )
}
