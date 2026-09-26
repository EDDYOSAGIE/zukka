import fs from 'fs'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      key: fs.readFileSync('./127.0.0.1+1-key.pem'),
      cert: fs.readFileSync('./127.0.0.1+1.pem'),
    },
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