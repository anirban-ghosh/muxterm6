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

test('starts with one terminal pane', async () => {
  const terminals = page.locator('.terminal-view')
  expect(await terminals.count()).toBe(1)
})

test('split divider appears after split', async () => {
  // Trigger split via Electron menu (keyboard shortcuts don't
  // reach native menu accelerators in Playwright)
  await app.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu()
    const item = menu?.getMenuItemById('split-vertical')
    if (item) item.click()
  })
  await page.waitForTimeout(500)

  const dividers = page.locator('.split-divider')
  expect(await dividers.count()).toBeGreaterThanOrEqual(1)

  const terminals = page.locator('.terminal-view')
  expect(await terminals.count()).toBe(2)
})
