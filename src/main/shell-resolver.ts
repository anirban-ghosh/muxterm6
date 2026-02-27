import { existsSync } from 'fs'

const FALLBACK_SHELLS = {
  darwin: ['/bin/zsh', '/bin/bash'],
  linux: ['/bin/bash', '/bin/sh'],
  win32: ['powershell.exe', 'cmd.exe']
}

export function resolveShell(): string {
  const envShell = process.env.SHELL
  if (envShell && existsSync(envShell)) {
    return envShell
  }

  const platform = process.platform as keyof typeof FALLBACK_SHELLS
  const candidates = FALLBACK_SHELLS[platform] || FALLBACK_SHELLS.linux

  for (const shell of candidates) {
    if (existsSync(shell)) {
      return shell
    }
  }

  return '/bin/sh'
}

export function getShellArgs(shell: string): string[] {
  if (process.platform === 'darwin') {
    return ['--login']
  }
  return []
}
