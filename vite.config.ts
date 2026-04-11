import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      lib: resolve(__dirname, "./lib"),
      tests: resolve(__dirname, "./tests"),
    },
  },
  define: {
    global: {},
  },
})
