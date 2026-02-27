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

test('starts with one tab', async () => {
  const tabs = page.locator('.tab')
  expect(await tabs.count()).toBe(1)
})

test('new tab button creates a tab', async () => {
  await page.locator('.tabbar__new').click()
  await page.waitForTimeout(500)
  const tabs = page.locator('.tab')
  expect(await tabs.count()).toBe(2)
})

test('clicking tab switches active', async () => {
  const tabs = page.locator('.tab')
  await tabs.first().click()
  await expect(tabs.first()).toHaveClass(/tab--active/)
})

test('close button removes a tab', async () => {
  const tabs = page.locator('.tab')
  const initialCount = await tabs.count()
  await tabs.last().locator('.tab__close').click()
  await page.waitForTimeout(300)
  expect(await tabs.count()).toBe(initialCount - 1)
})
