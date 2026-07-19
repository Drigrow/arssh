import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  plugins: [
    react(),
    electron([
      {
        entry: 'main/index.js',
        vite: {
          build: {
            rollupOptions: {
              external: ['ssh2', 'electron-store', 'uuid']
            }
          }
        }
      },
      {
        entry: 'main/preload.js',
        onstart(options) {
          options.reload()
        },
      }
    ]),
    renderer(),
  ],
})
