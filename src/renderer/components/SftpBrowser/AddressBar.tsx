import React, { useState, useRef, useEffect } from 'react'

interface AddressBarProps {
  path: string
  onNavigate: (path: string) => void
  label: string
}

export const AddressBar: React.FC<AddressBarProps> = ({ path, onNavigate, label }) => {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(path)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(path)
  }, [path])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select()
    }
  }, [editing])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      setEditing(false)
      if (value.trim()) {
        onNavigate(value.trim())
      } else {
        setValue(path)
      }
    } else if (e.key === 'Escape') {
      setEditing(false)
      setValue(path)
    }
  }

  const handleBlur = () => {
    setEditing(false)
    setValue(path)
  }

  return (
    <div className="sftp-address-bar">
      <span className="sftp-address-bar__label">{label}</span>
      {editing ? (
        <input
          ref={inputRef}
          className="sftp-address-bar__input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
      ) : (
        <div className="sftp-address-bar__path" onClick={() => setEditing(true)}>
          {path || '/'}
        </div>
      )}
    </div>
  )
}
