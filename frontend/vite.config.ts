import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,       // binds to 0.0.0.0 — required to be reachable from outside the container
    port: 5173,
    strictPort: true,
  },
})