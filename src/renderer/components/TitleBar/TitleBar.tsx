import React from 'react'
import { TabBar } from '../TabBar/TabBar'

interface TitleBarProps {
  children?: React.ReactNode
}

export const TitleBar: React.FC<TitleBarProps> = ({ children }) => {
  return (
    <div className="titlebar">
      <div className="titlebar__traffic-light-spacer" />
      {children}
    </div>
  )
}
