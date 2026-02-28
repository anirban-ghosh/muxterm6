import React, { useCallback, useRef } from 'react'
import type { FileEntry } from '@shared/sftp-types'

interface FileBrowserProps {
  files: FileEntry[]
  loading: boolean
  selection: Set<string>
  onSelectionChange: (selection: Set<string>) => void
  onNavigate: (path: string) => void
  onDoubleClick: (entry: FileEntry) => void
  onDragStart: (entries: FileEntry[], side: 'local' | 'remote') => void
  onDrop: (targetPath: string) => void
  side: 'local' | 'remote'
  currentPath: string
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '--'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function formatDate(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function parentPath(p: string): string {
  if (p === '/' || !p) return '/'
  const parts = p.split('/').filter(Boolean)
  parts.pop()
  return '/' + parts.join('/')
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  files,
  loading,
  selection,
  onSelectionChange,
  onNavigate,
  onDoubleClick,
  onDragStart,
  onDrop,
  side,
  currentPath
}) => {
  const lastClickIndex = useRef<number>(-1)

  const handleClick = useCallback(
    (entry: FileEntry, index: number, e: React.MouseEvent) => {
      const path = entry.path

      if (e.metaKey || e.ctrlKey) {
        const next = new Set(selection)
        if (next.has(path)) {
          next.delete(path)
        } else {
          next.add(path)
        }
        onSelectionChange(next)
      } else if (e.shiftKey && lastClickIndex.current >= 0) {
        const start = Math.min(lastClickIndex.current, index)
        const end = Math.max(lastClickIndex.current, index)
        const next = new Set(selection)
        for (let i = start; i <= end; i++) {
          next.add(files[i].path)
        }
        onSelectionChange(next)
      } else {
        onSelectionChange(new Set([path]))
      }

      lastClickIndex.current = index
    },
    [files, selection, onSelectionChange]
  )

  const handleDoubleClick = useCallback(
    (entry: FileEntry) => {
      if (entry.isDirectory) {
        onNavigate(entry.path)
      } else {
        onDoubleClick(entry)
      }
    },
    [onNavigate, onDoubleClick]
  )

  const handleDragStart = useCallback(
    (e: React.DragEvent, entry: FileEntry) => {
      const selected = selection.has(entry.path)
        ? files.filter((f) => selection.has(f.path))
        : [entry]
      e.dataTransfer.setData('text/plain', JSON.stringify(selected.map((f) => f.path)))
      e.dataTransfer.setData('application/x-sftp-side', side)
      e.dataTransfer.effectAllowed = 'copyMove'
      onDragStart(selected, side)
    },
    [files, selection, side, onDragStart]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      onDrop(currentPath)
    },
    [currentPath, onDrop]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === 'a') {
        e.preventDefault()
        onSelectionChange(new Set(files.map((f) => f.path)))
      }
    },
    [files, onSelectionChange]
  )

  return (
    <div
      className="sftp-file-browser"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="sftp-file-browser__header">
        <span className="sftp-file-browser__col sftp-file-browser__col--name">Name</span>
        <span className="sftp-file-browser__col sftp-file-browser__col--size">Size</span>
        <span className="sftp-file-browser__col sftp-file-browser__col--date">Modified</span>
        <span className="sftp-file-browser__col sftp-file-browser__col--perms">Perms</span>
      </div>
      <div className="sftp-file-browser__list">
        {loading ? (
          <div className="sftp-file-browser__loading">Loading...</div>
        ) : (
          <>
            {currentPath !== '/' && (
              <div
                className="sftp-file-browser__row"
                onDoubleClick={() => onNavigate(parentPath(currentPath))}
              >
                <span className="sftp-file-browser__col sftp-file-browser__col--name">
                  <span className="sftp-file-browser__icon">{'../'}</span>
                  ..
                </span>
                <span className="sftp-file-browser__col sftp-file-browser__col--size">--</span>
                <span className="sftp-file-browser__col sftp-file-browser__col--date">--</span>
                <span className="sftp-file-browser__col sftp-file-browser__col--perms">--</span>
              </div>
            )}
            {files.map((entry, index) => (
              <div
                key={entry.path}
                className={`sftp-file-browser__row ${selection.has(entry.path) ? 'sftp-file-browser__row--selected' : ''}`}
                onClick={(e) => handleClick(entry, index, e)}
                onDoubleClick={() => handleDoubleClick(entry)}
                draggable
                onDragStart={(e) => handleDragStart(e, entry)}
              >
                <span className="sftp-file-browser__col sftp-file-browser__col--name">
                  <span className="sftp-file-browser__icon">
                    {entry.isDirectory ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}
                  </span>
                  {entry.name}
                </span>
                <span className="sftp-file-browser__col sftp-file-browser__col--size">
                  {entry.isDirectory ? '--' : formatSize(entry.size)}
                </span>
                <span className="sftp-file-browser__col sftp-file-browser__col--date">
                  {formatDate(entry.modifiedAt)}
                </span>
                <span className="sftp-file-browser__col sftp-file-browser__col--perms">
                  {entry.permissions}
                </span>
              </div>
            ))}
            {files.length === 0 && !loading && (
              <div className="sftp-file-browser__empty">Empty directory</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
