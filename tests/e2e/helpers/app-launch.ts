import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { resolve } from 'path'

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const args = [resolve(__dirname, '../../../out/main/index.js')]
  if (process.env.CI && process.platform === 'linux') {
    args.unshift('--no-sandbox')
  }
  const app = await electron.launch({
    args,
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  // Wait for the terminal to initialize
  await page.waitForSelector('.terminal-view', { timeout: 10000 })
  // Give terminal time to connect to pty
  await page.waitForTimeout(1000)

  return { app, page }
}

export async function closeApp(app: ElectronApplication | undefined): Promise<void> {
  if (!app) return
  // app.close() can hang when PTY child processes don't exit cleanly.
  // Race against a 5s timeout, then force-kill the process tree.
  const pid = app.process().pid
  try {
    await Promise.race([
      app.close(),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('close timeout')), 5000)
      )
    ])
  } catch {
    if (pid) {
      try { process.kill(pid, 'SIGKILL') } catch { /* already dead */ }
    }
  }
}
