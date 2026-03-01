import { test, expect } from '@playwright/test'
import { launchApp, closeApp } from './helpers/app-launch'
import type { ElectronApplication, Page } from '@playwright/test'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const result = await launchApp()
  app = result.app
  page = result.page
})

test.afterAll(async () => {
  await closeApp(app)
})

test('can open a new window', async () => {
  const windowsBefore = app.windows().length

  // Use Cmd+N to open a new window
  await page.keyboard.press('Meta+n')
  await page.waitForTimeout(1000)

  const windowsAfter = app.windows().length
  expect(windowsAfter).toBe(windowsBefore + 1)
})
