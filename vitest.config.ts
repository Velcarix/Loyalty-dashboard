import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'

export default defineConfig({
  define: {
    'import.meta.env.VITE_LOYALTY_API_URL': JSON.stringify('https://api.test'),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    restoreMocks: true,
  },
})
