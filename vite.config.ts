import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wyw from '@wyw-in-js/vite'

export default defineConfig({
  server: {
    port: 3001,
    strictPort: true,
  },
  plugins: [
    react(),
    wyw({
      include: ['src/**/*.{ts,tsx}'],
    }),
  ],
})
