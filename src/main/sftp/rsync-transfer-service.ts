import { spawn, type ChildProcess } from 'child_process'
import { BrowserWindow } from 'electron'
import { SFTP_IPC } from '@shared/sftp-ipc-channels'
import type { TransferRequest, TransferProgress } from '@shared/sftp-types'
import { sftpConnectionManager } from './sftp-connection-manager'
import logger from '../logger'

const activeTransfers = new Map<string, ChildProcess>()
let rsyncAvailable: boolean | null = null

async function checkRsync(): Promise<boolean> {
  if (rsyncAvailable !== null) return rsyncAvailable
  return new Promise((resolve) => {
    const proc = spawn('rsync', ['--version'])
    proc.on('error', () => {
      rsyncAvailable = false
      resolve(false)
    })
    proc.on('close', (code) => {
      rsyncAvailable = code === 0
      resolve(rsyncAvailable)
    })
  })
}

function parseRsyncProgress(line: string): Partial<TransferProgress> | null {
  // rsync progress format: "  1,234,567  45%   1.23MB/s    0:01:23"
  const match = line.match(
    /^\s*([\d,]+)\s+(\d+)%\s+([\d.]+\S+\/s)/
  )
  if (!match) return null
  return {
    bytesTransferred: parseInt(match[1].replace(/,/g, ''), 10),
    percentage: parseInt(match[2], 10),
    speed: match[3]
  }
}

export async function startTransfer(
  windowId: number,
  request: TransferRequest
): Promise<void> {
  const win = BrowserWindow.fromId(windowId)
  if (!win || win.isDestroyed()) return

  const hasRsync = await checkRsync()
  const config = sftpConnectionManager.getConfig(windowId)

  if (hasRsync && config) {
    await rsyncTransfer(win, windowId, request, config)
  } else {
    await sftpFallbackTransfer(win, windowId, request)
  }
}

async function rsyncTransfer(
  win: BrowserWindow,
  windowId: number,
  request: TransferRequest,
  config: { hostname: string; port: number; username: string; identityFile?: string }
): Promise<void> {
  const sshArgs = [`ssh -p ${config.port}`]
  if (config.identityFile) {
    sshArgs[0] += ` -i "${config.identityFile}"`
  }
  sshArgs[0] += ' -o StrictHostKeyChecking=no'

  const args = ['-avz', '--progress', '-e', sshArgs[0]]

  let src: string
  let dest: string

  if (request.direction === 'upload') {
    src = request.sourcePath
    dest = `${config.username}@${config.hostname}:${request.destPath}`
  } else {
    src = `${config.username}@${config.hostname}:${request.sourcePath}`
    dest = request.destPath
  }

  args.push(src, dest)

  const proc = spawn('rsync', args)
  activeTransfers.set(request.transferId, proc)

  const filename = request.sourcePath.split('/').pop() || 'file'

  proc.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n')
    for (const line of lines) {
      const progress = parseRsyncProgress(line)
      if (progress && !win.isDestroyed()) {
        win.webContents.send(SFTP_IPC.TRANSFER_PROGRESS, {
          transferId: request.transferId,
          filename,
          bytesTransferred: progress.bytesTransferred || 0,
          totalBytes: 0,
          percentage: progress.percentage || 0,
          speed: progress.speed || ''
        } satisfies TransferProgress)
      }
    }
  })

  proc.stderr?.on('data', (data: Buffer) => {
    logger.warn({ transferId: request.transferId }, `rsync stderr: ${data.toString().trim()}`)
  })

  proc.on('close', (code) => {
    activeTransfers.delete(request.transferId)
    if (win.isDestroyed()) return

    if (code === 0) {
      win.webContents.send(SFTP_IPC.TRANSFER_COMPLETE, request.transferId)
    } else if (code !== null) {
      win.webContents.send(
        SFTP_IPC.TRANSFER_ERROR,
        request.transferId,
        `rsync exited with code ${code}`
      )
    }
  })

  proc.on('error', (err) => {
    activeTransfers.delete(request.transferId)
    if (!win.isDestroyed()) {
      win.webContents.send(SFTP_IPC.TRANSFER_ERROR, request.transferId, err.message)
    }
  })
}

async function sftpFallbackTransfer(
  win: BrowserWindow,
  windowId: number,
  request: TransferRequest
): Promise<void> {
  const client = sftpConnectionManager.getClient(windowId)
  const filename = request.sourcePath.split('/').pop() || 'file'

  try {
    if (request.direction === 'upload') {
      await client.fastPut(request.sourcePath, request.destPath, {
        step: (transferred: number, _chunk: number, total: number) => {
          if (!win.isDestroyed()) {
            win.webContents.send(SFTP_IPC.TRANSFER_PROGRESS, {
              transferId: request.transferId,
              filename,
              bytesTransferred: transferred,
              totalBytes: total,
              percentage: total > 0 ? Math.round((transferred / total) * 100) : 0,
              speed: ''
            } satisfies TransferProgress)
          }
        }
      })
    } else {
      await client.fastGet(request.sourcePath, request.destPath, {
        step: (transferred: number, _chunk: number, total: number) => {
          if (!win.isDestroyed()) {
            win.webContents.send(SFTP_IPC.TRANSFER_PROGRESS, {
              transferId: request.transferId,
              filename,
              bytesTransferred: transferred,
              totalBytes: total,
              percentage: total > 0 ? Math.round((transferred / total) * 100) : 0,
              speed: ''
            } satisfies TransferProgress)
          }
        }
      })
    }

    if (!win.isDestroyed()) {
      win.webContents.send(SFTP_IPC.TRANSFER_COMPLETE, request.transferId)
    }
  } catch (err) {
    if (!win.isDestroyed()) {
      win.webContents.send(
        SFTP_IPC.TRANSFER_ERROR,
        request.transferId,
        err instanceof Error ? err.message : String(err)
      )
    }
  }
}

export function cancelTransfer(transferId: string): void {
  const proc = activeTransfers.get(transferId)
  if (proc) {
    proc.kill('SIGTERM')
    activeTransfers.delete(transferId)
  }
}
