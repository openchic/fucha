import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const sharedAlias = { '@shared': resolve('src/shared') }

export default defineConfig(({ mode }) => ({
  main: {
    define: {
      'process.env.APP_CHANNEL': JSON.stringify(mode === 'debug' ? 'development' : 'production'),
    },
    resolve: {
      alias: sharedAlias,
    },
  },
  preload: {
    resolve: {
      alias: sharedAlias,
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        ...sharedAlias,
      },
    },
    plugins: [react(), tailwindcss()],
  },
}))
