import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wyw from '@wyw-in-js/vite'

export default defineConfig({
  plugins: [
    react(),
    wyw({
      include: ['src/**/*.{js,jsx}'],
      babelOptions: {
        presets: ['@babel/preset-react'],
      },
    }),
  ],
})
