import type { MuxTheme } from './theme'

export const darkTheme: MuxTheme = {
  name: 'dark',
  colors: {
    bg: '#0f0f1a',
    bgSecondary: '#161625',
    bgTitlebar: 'rgba(15, 15, 26, 0.85)',
    bgTab: '#1a1a2e',
    bgTabActive: '#252540',
    bgStatusbar: '#0d0d16',
    text: '#e0e0f0',
    textMuted: '#6a6a8a',
    textTab: '#8888aa',
    textTabActive: '#e0e0f0',
    border: '#2a2a40',
    accent: '#6c6cff',
    accentMuted: '#4a4a99',
    cursor: '#6c6cff',
    selection: 'rgba(108, 108, 255, 0.25)',
    splitDivider: '#2a2a40',
    splitDividerHover: '#6c6cff'
  },
  terminal: {
    background: '#0f0f1a',
    foreground: '#e0e0f0',
    cursor: '#6c6cff',
    cursorAccent: '#0f0f1a',
    selectionBackground: 'rgba(108, 108, 255, 0.3)',
    selectionForeground: '#ffffff',
    black: '#1a1a2e',
    red: '#ff6b6b',
    green: '#69db7c',
    yellow: '#ffd43b',
    blue: '#6c6cff',
    magenta: '#cc5de8',
    cyan: '#66d9e8',
    white: '#e0e0f0',
    brightBlack: '#4a4a6a',
    brightRed: '#ff8787',
    brightGreen: '#8ce99a',
    brightYellow: '#ffe066',
    brightBlue: '#9191ff',
    brightMagenta: '#e599f7',
    brightCyan: '#99e9f2',
    brightWhite: '#ffffff'
  },
  font: {
    family: "'SF Mono', 'Cascadia Code', 'JetBrains Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace",
    size: 13,
    lineHeight: 1.3
  }
}
