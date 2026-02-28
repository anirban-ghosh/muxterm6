import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { join, resolve } from 'path'
import type { SshHostConfig } from '@shared/sftp-types'

export async function parseSshConfig(): Promise<SshHostConfig[]> {
  const configPath = join(homedir(), '.ssh', 'config')
  let content: string
  try {
    content = await readFile(configPath, 'utf-8')
  } catch {
    return []
  }

  const hosts: SshHostConfig[] = []
  let current: Partial<SshHostConfig> | null = null

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const match = line.match(/^(\S+)\s+(.+)$/)
    if (!match) continue

    const [, key, value] = match
    const keyLower = key.toLowerCase()

    if (keyLower === 'host') {
      // Flush previous
      if (current?.host && !current.host.includes('*') && !current.host.includes('?')) {
        hosts.push({
          host: current.host,
          hostname: current.hostname || current.host,
          port: current.port || 22,
          user: current.user || '',
          identityFile: current.identityFile
        })
      }
      current = { host: value.split(/\s+/)[0] }
    } else if (current) {
      switch (keyLower) {
        case 'hostname':
          current.hostname = value
          break
        case 'port':
          current.port = parseInt(value, 10)
          break
        case 'user':
          current.user = value
          break
        case 'identityfile':
          current.identityFile = expandTilde(value)
          break
      }
    }
  }

  // Flush last entry
  if (current?.host && !current.host.includes('*') && !current.host.includes('?')) {
    hosts.push({
      host: current.host,
      hostname: current.hostname || current.host,
      port: current.port || 22,
      user: current.user || '',
      identityFile: current.identityFile
    })
  }

  return hosts
}

function expandTilde(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return resolve(join(homedir(), p.slice(1)))
  }
  return p
}
