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
