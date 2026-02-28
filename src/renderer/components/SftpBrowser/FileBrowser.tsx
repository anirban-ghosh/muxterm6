import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react'
import type { FileEntry } from '@shared/sftp-types'

type SortColumn = 'name' | 'size' | 'date' | 'perms'
type SortDirection = 'asc' | 'desc'

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
  onContextCut?: () => void
  onContextCopy?: () => void
  onContextPaste?: () => void
  onContextDelete?: () => void
  onContextSendTo?: () => void
  clipboardHasContent?: boolean
  connected?: boolean
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
  currentPath,
  onContextCut,
  onContextCopy,
  onContextPaste,
  onContextDelete,
  onContextSendTo,
  clipboardHasContent = false,
  connected = false
}) => {
  const lastClickIndex = useRef<number>(-1)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const listRef = useRef<HTMLDivElement>(null)

  // Sort files: dirs always first, then by selected column
  const sortedFiles = useMemo(() => {
    const sorted = [...files]
    sorted.sort((a, b) => {
      // Directories always first
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1

      let cmp = 0
      switch (sortColumn) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'size':
          cmp = a.size - b.size
          break
        case 'date':
          cmp = a.modifiedAt - b.modifiedAt
          break
        case 'perms':
          cmp = a.permissions.localeCompare(b.permissions)
          break
      }

      return sortDirection === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [files, sortColumn, sortDirection])

  const handleColumnClick = useCallback((col: SortColumn) => {
    setSortColumn((prev) => {
      if (prev === col) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDirection('asc')
      return col
    })
  }, [])

  const sortIndicator = useCallback(
    (col: SortColumn) => {
      if (sortColumn !== col) return null
      return sortDirection === 'asc' ? ' \u25B2' : ' \u25BC'
    },
    [sortColumn, sortDirection]
  )

  // Close context menu on click outside, scroll, or Escape
  useEffect(() => {
    if (!contextMenu) return

    const close = () => setContextMenu(null)
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }

    document.addEventListener('click', close)
    document.addEventListener('scroll', close, true)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('scroll', close, true)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu])

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
          next.add(sortedFiles[i].path)
        }
        onSelectionChange(next)
      } else {
        onSelectionChange(new Set([path]))
      }

      lastClickIndex.current = index
    },
    [sortedFiles, selection, onSelectionChange]
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
        ? sortedFiles.filter((f) => selection.has(f.path))
        : [entry]
      e.dataTransfer.setData('text/plain', JSON.stringify(selected.map((f) => f.path)))
      e.dataTransfer.setData('application/x-sftp-side', side)
      e.dataTransfer.effectAllowed = 'copyMove'
      onDragStart(selected, side)
    },
    [sortedFiles, selection, side, onDragStart]
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
        onSelectionChange(new Set(sortedFiles.map((f) => f.path)))
      }
    },
    [sortedFiles, onSelectionChange]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, entry: FileEntry) => {
      e.preventDefault()
      e.stopPropagation()

      // If right-clicked entry is not in selection, select it exclusively
      if (!selection.has(entry.path)) {
        onSelectionChange(new Set([entry.path]))
      }

      setContextMenu({ x: e.clientX, y: e.clientY })
    },
    [selection, onSelectionChange]
  )

  const handleContextMenuAction = useCallback(
    (action: () => void | undefined) => {
      setContextMenu(null)
      action?.()
    },
    []
  )

  const otherSide = side === 'local' ? 'Remote' : 'Local'

  return (
    <div
      className="sftp-file-browser"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="sftp-file-browser__header">
        <span
          className="sftp-file-browser__col sftp-file-browser__col--name sftp-file-browser__col--sortable"
          onClick={() => handleColumnClick('name')}
        >
          Name{sortIndicator('name')}
        </span>
        <span
          className="sftp-file-browser__col sftp-file-browser__col--size sftp-file-browser__col--sortable"
          onClick={() => handleColumnClick('size')}
        >
          Size{sortIndicator('size')}
        </span>
        <span
          className="sftp-file-browser__col sftp-file-browser__col--date sftp-file-browser__col--sortable"
          onClick={() => handleColumnClick('date')}
        >
          Modified{sortIndicator('date')}
        </span>
        <span
          className="sftp-file-browser__col sftp-file-browser__col--perms sftp-file-browser__col--sortable"
          onClick={() => handleColumnClick('perms')}
        >
          Perms{sortIndicator('perms')}
        </span>
      </div>
      <div className="sftp-file-browser__list" ref={listRef}>
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
            {sortedFiles.map((entry, index) => (
              <div
                key={entry.path}
                className={`sftp-file-browser__row ${selection.has(entry.path) ? 'sftp-file-browser__row--selected' : ''}`}
                onClick={(e) => handleClick(entry, index, e)}
                onDoubleClick={() => handleDoubleClick(entry)}
                onContextMenu={(e) => handleContextMenu(e, entry)}
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
            {sortedFiles.length === 0 && !loading && (
              <div className="sftp-file-browser__empty">Empty directory</div>
            )}
          </>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="sftp-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {onContextCut && (
            <div
              className="sftp-context-menu__item"
              onClick={() => handleContextMenuAction(onContextCut)}
            >
              Cut
            </div>
          )}
          {onContextCopy && (
            <div
              className="sftp-context-menu__item"
              onClick={() => handleContextMenuAction(onContextCopy)}
            >
              Copy
            </div>
          )}
          {onContextPaste && (
            <div
              className={`sftp-context-menu__item ${!clipboardHasContent ? 'sftp-context-menu__item--disabled' : ''}`}
              onClick={() => clipboardHasContent && handleContextMenuAction(onContextPaste)}
            >
              Paste
            </div>
          )}
          {(onContextCut || onContextCopy || onContextPaste) &&
            (onContextDelete || (onContextSendTo && connected)) && (
              <div className="sftp-context-menu__separator" />
            )}
          {onContextDelete && (
            <div
              className="sftp-context-menu__item sftp-context-menu__item--danger"
              onClick={() => handleContextMenuAction(onContextDelete)}
            >
              Delete
            </div>
          )}
          {onContextSendTo && connected && (
            <div
              className="sftp-context-menu__item"
              onClick={() => handleContextMenuAction(onContextSendTo)}
            >
              Send to {otherSide}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
