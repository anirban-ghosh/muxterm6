import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { ptyManager } from './pty-manager'
import logger from './logger'

class WindowManager {
  private windows = new Set<BrowserWindow>()

  createWindow(): BrowserWindow {
    const win = new BrowserWindow({
      width: 900,
      height: 600,
      minWidth: 400,
      minHeight: 300,
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 12, y: 12 },
      vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
      backgroundColor: '#0f0f1a',
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    win.on('ready-to-show', () => {
      win.show()
    })

    win.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })

    win.on('closed', () => {
      ptyManager.destroyAllForWindow(win.id)
      this.windows.delete(win)
      logger.info({ windowId: win.id }, 'window closed')
    })

    if (process.env.ELECTRON_RENDERER_URL) {
      win.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'))
    }

    this.windows.add(win)
    logger.info({ windowId: win.id }, 'window created')
    return win
  }

  createTmuxWindow(sessionId: string): BrowserWindow {
    const win = new BrowserWindow({
      width: 900,
      height: 600,
      minWidth: 400,
      minHeight: 300,
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 12, y: 12 },
      vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
      backgroundColor: '#0f0f1a',
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    win.on('ready-to-show', () => {
      win.show()
    })

    win.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })

    win.on('closed', () => {
      this.windows.delete(win)
      logger.info({ windowId: win.id }, 'tmux window closed')
    })

    const queryString = `tmux=${encodeURIComponent(sessionId)}`
    if (process.env.ELECTRON_RENDERER_URL) {
      win.loadURL(`${process.env.ELECTRON_RENDERER_URL}?${queryString}`)
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'), { search: queryString })
    }

    this.windows.add(win)
    logger.info({ windowId: win.id, sessionId }, 'tmux window created')
    return win
  }

  getWindowCount(): number {
    return this.windows.size
  }

  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows)
  }
}

export const windowManager = new WindowManager()
