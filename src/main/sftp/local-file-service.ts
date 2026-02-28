import { readdir, stat, rename, cp, rm, mkdir, access } from 'fs/promises'
import { homedir } from 'os'
import { join, basename } from 'path'
import { shell } from 'electron'
import type { FileEntry } from '@shared/sftp-types'

function formatPermissions(mode: number): string {
  const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx']
  const owner = (mode >> 6) & 7
  const group = (mode >> 3) & 7
  const other = mode & 7
  return perms[owner] + perms[group] + perms[other]
}

export async function localList(dirPath: string): Promise<FileEntry[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const results: FileEntry[] = []

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    try {
      const s = await stat(fullPath)
      results.push({
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
        size: s.size,
        modifiedAt: s.mtimeMs,
        permissions: formatPermissions(s.mode)
      })
    } catch {
      // Skip entries we can't stat (broken symlinks, etc.)
    }
  }

  results.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return results
}

export async function localRename(oldPath: string, newPath: string): Promise<void> {
  await rename(oldPath, newPath)
}

export async function localCopy(src: string, dest: string): Promise<void> {
  await cp(src, dest, { recursive: true })
}

export async function localDelete(filePath: string, isDir: boolean): Promise<void> {
  await rm(filePath, { recursive: isDir, force: true })
}

export async function localMkdir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true })
}

export async function localExists(filePath: string): Promise<false | 'd' | '-'> {
  try {
    const s = await stat(filePath)
    return s.isDirectory() ? 'd' : '-'
  } catch {
    return false
  }
}

export function localHome(): string {
  return homedir()
}

export async function localOpenFile(filePath: string): Promise<void> {
  await shell.openPath(filePath)
}
