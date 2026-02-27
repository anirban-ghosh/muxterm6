import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    globals: true
  },
  resolve: {
    alias: {
      '@shared': resolve('src/shared')
    }
  }
})
