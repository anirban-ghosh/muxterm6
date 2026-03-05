import { BrowserWindow, shell, nativeImage } from 'electron'
import { join } from 'path'
import { ptyManager } from './pty-manager'
import logger from './logger'

const isMac = process.platform === 'darwin'

function getLinuxIcon(): Electron.NativeImage | undefined {
  if (isMac) return undefined
  const icon = nativeImage.createFromPath(join(process.resourcesPath, 'icon.png'))
  return icon.isEmpty() ? undefined : icon
}

class WindowManager {
  private windows = new Set<BrowserWindow>()

  toggleMenuBar(win: BrowserWindow): void {
    const visible = !win.isMenuBarVisible()
    win.setMenuBarVisibility(visible)
    win.setAutoHideMenuBar(!visible)
  }

  createWindow(): BrowserWindow {
    const win = new BrowserWindow({
      width: 900,
      height: 600,
      minWidth: 400,
      minHeight: 300,
      titleBarStyle: isMac ? 'hidden' : 'default',
      trafficLightPosition: { x: 12, y: 12 },
      icon: getLinuxIcon(),
      vibrancy: isMac ? 'under-window' : undefined,
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
      titleBarStyle: isMac ? 'hidden' : 'default',
      trafficLightPosition: { x: 12, y: 12 },
      icon: getLinuxIcon(),
      vibrancy: isMac ? 'under-window' : undefined,
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

  createSftpWindow(): BrowserWindow {
    const win = new BrowserWindow({
      width: 1100,
      height: 700,
      minWidth: 700,
      minHeight: 400,
      titleBarStyle: isMac ? 'hidden' : 'default',
      trafficLightPosition: { x: 12, y: 12 },
      icon: getLinuxIcon(),
      vibrancy: isMac ? 'under-window' : undefined,
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
      logger.info({ windowId: win.id }, 'sftp window closed')
    })

    const queryString = 'sftp=true'
    if (process.env.ELECTRON_RENDERER_URL) {
      win.loadURL(`${process.env.ELECTRON_RENDERER_URL}?${queryString}`)
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'), { search: queryString })
    }

    this.windows.add(win)
    logger.info({ windowId: win.id }, 'sftp window created')
    return win
  }

  createTunnelWindow(): BrowserWindow {
    // Single-instance: if tunnel window already open, focus it
    for (const w of this.windows) {
      if (w.webContents.getURL().includes('tunnel=true')) {
        w.focus()
        return w
      }
    }

    const win = new BrowserWindow({
      width: 800,
      height: 500,
      minWidth: 600,
      minHeight: 350,
      titleBarStyle: isMac ? 'hidden' : 'default',
      trafficLightPosition: { x: 12, y: 12 },
      icon: getLinuxIcon(),
      vibrancy: isMac ? 'under-window' : undefined,
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
      logger.info({ windowId: win.id }, 'tunnel window closed')
    })

    const queryString = 'tunnel=true'
    if (process.env.ELECTRON_RENDERER_URL) {
      win.loadURL(`${process.env.ELECTRON_RENDERER_URL}?${queryString}`)
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'), { search: queryString })
    }

    this.windows.add(win)
    logger.info({ windowId: win.id }, 'tunnel window created')
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
