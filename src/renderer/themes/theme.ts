export interface MuxTheme {
  name: string
  colors: {
    bg: string
    bgSecondary: string
    bgTitlebar: string
    bgTab: string
    bgTabActive: string
    bgStatusbar: string
    text: string
    textMuted: string
    textTab: string
    textTabActive: string
    border: string
    accent: string
    accentMuted: string
    cursor: string
    selection: string
    splitDivider: string
    splitDividerHover: string
  }
  terminal: {
    background: string
    foreground: string
    cursor: string
    cursorAccent: string
    selectionBackground: string
    selectionForeground: string
    black: string
    red: string
    green: string
    yellow: string
    blue: string
    magenta: string
    cyan: string
    white: string
    brightBlack: string
    brightRed: string
    brightGreen: string
    brightYellow: string
    brightBlue: string
    brightMagenta: string
    brightCyan: string
    brightWhite: string
  }
  font: {
    family: string
    size: number
    lineHeight: number
  }
}
