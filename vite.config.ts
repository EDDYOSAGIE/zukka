import fs from 'fs'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";



const isLocalDev = process.env.NODE_ENV !== 'production'

export default defineConfig({
  plugins: [react()],
  server: {
    ...(isLocalDev && fs.existsSync('./zukka.local-key.pem')
      ? {
          https: {
            key: fs.readFileSync('./zukka.local-key.pem'),
            cert: fs.readFileSync('./zukka.local.pem'),
          },
        }
      : {}),
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, "")
      },
      "/v1": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        secure: false
      },
      "/socket.io": {
        target: "http://127.0.0.1:8080",
        ws: true,
        secure: false
      }
    }
  }
});