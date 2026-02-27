import type { Page } from '@playwright/test'

export async function typeInTerminal(page: Page, text: string): Promise<void> {
  const terminal = page.locator('.terminal-view .xterm-helper-textarea')
  await terminal.first().focus()
  for (const char of text) {
    await terminal.first().press(char === '\n' ? 'Enter' : char)
    await page.waitForTimeout(30)
  }
}

export async function waitForTerminalOutput(
  page: Page,
  text: string,
  timeout = 5000
): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const content = await page.locator('.xterm-rows').first().textContent()
    if (content && content.includes(text)) {
      return true
    }
    await page.waitForTimeout(200)
  }
  return false
}
