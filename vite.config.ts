import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Nomen is a local-first PWA: no backend, no analytics, no network calls at runtime.
// `base` is relative so the built bundle works from GitHub Pages, a file:// copy,
// or any sub-path deployment without reconfiguration.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
