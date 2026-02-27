import { test, expect } from '@playwright/test'
import { launchApp } from './helpers/app-launch'
import { typeInTerminal, waitForTerminalOutput } from './helpers/terminal-helpers'
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

test('can type and see output in terminal', async () => {
  await typeInTerminal(page, 'echo hello-muxterm\n')
  const found = await waitForTerminalOutput(page, 'hello-muxterm')
  expect(found).toBe(true)
})
