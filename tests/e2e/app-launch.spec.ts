import { test, expect } from '@playwright/test'
import { launchApp } from './helpers/app-launch'
import type { ElectronApplication, Page } from '@playwright/test'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const result = await launchApp()
  app = result.app
  page = result.page
})

test.afterAll(async () => {
  await app?.close()
})

test('app window opens', async () => {
  const title = await page.title()
  expect(title).toBe('MuxTerm')
})

test('has titlebar', async () => {
  const titlebar = page.locator('.titlebar')
  await expect(titlebar).toBeVisible()
})

test('has terminal view', async () => {
  const terminal = page.locator('.terminal-view')
  await expect(terminal.first()).toBeVisible()
})

test('has status bar', async () => {
  const statusbar = page.locator('.statusbar')
  await expect(statusbar).toBeVisible()
})

test('has at least one tab', async () => {
  const tabs = page.locator('.tab')
  expect(await tabs.count()).toBeGreaterThanOrEqual(1)
})
