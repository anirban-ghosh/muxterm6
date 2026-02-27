import type { MuxTheme } from './theme'

export const lightTheme: MuxTheme = {
  name: 'light',
  colors: {
    bg: '#f8f8fc',
    bgSecondary: '#efeffa',
    bgTitlebar: 'rgba(248, 248, 252, 0.85)',
    bgTab: '#e8e8f4',
    bgTabActive: '#ffffff',
    bgStatusbar: '#efeffa',
    text: '#1a1a2e',
    textMuted: '#8888aa',
    textTab: '#6a6a8a',
    textTabActive: '#1a1a2e',
    border: '#d8d8e8',
    accent: '#5555dd',
    accentMuted: '#8888cc',
    cursor: '#5555dd',
    selection: 'rgba(85, 85, 221, 0.15)',
    splitDivider: '#d8d8e8',
    splitDividerHover: '#5555dd'
  },
  terminal: {
    background: '#f8f8fc',
    foreground: '#1a1a2e',
    cursor: '#5555dd',
    cursorAccent: '#f8f8fc',
    selectionBackground: 'rgba(85, 85, 221, 0.2)',
    selectionForeground: '#1a1a2e',
    black: '#1a1a2e',
    red: '#d63031',
    green: '#00b894',
    yellow: '#d4a017',
    blue: '#5555dd',
    magenta: '#a55eea',
    cyan: '#0984e3',
    white: '#dfe6e9',
    brightBlack: '#636e72',
    brightRed: '#ff7675',
    brightGreen: '#55efc4',
    brightYellow: '#fdcb6e',
    brightBlue: '#7474ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#74b9ff',
    brightWhite: '#ffffff'
  },
  font: {
    family: "'SF Mono', 'Cascadia Code', 'JetBrains Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace",
    size: 13,
    lineHeight: 1.3
  }
}
