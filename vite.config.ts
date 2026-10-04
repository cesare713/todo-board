import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const API_SERVER = 'http://localhost:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // GitHub OAuth 콜백 URL과 포트가 같아야 함
    proxy: {
      '/api': API_SERVER,
      '/auth': API_SERVER,
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
