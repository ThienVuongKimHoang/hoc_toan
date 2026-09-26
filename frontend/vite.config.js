import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

/* Mã định danh của lần build này. Được nhúng vào bundle qua __APP_VERSION__ VÀ ghi ra
   dist/version.json. Tab đang mở so hai giá trị đó để biết server đã có bản mới chưa
   (xem src/realtime/appVersion.js). Dùng timestamp vì build chạy trong Docker — không
   có sẵn git để lấy commit sha. */
const BUILD_ID = Date.now().toString(36)

/** Ghi dist/version.json sau khi build xong. */
function emitVersion() {
  let outDir = 'dist'
  return {
    name: 'emit-version',
    apply: 'build',
    configResolved(cfg) {
      outDir = cfg.build.outDir
    },
    closeBundle() {
      const dir = resolve(outDir)
      mkdirSync(dir, { recursive: true })
      writeFileSync(
        resolve(dir, 'version.json'),
        JSON.stringify({ version: BUILD_ID }),
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), emitVersion()],
  define: {
    __APP_VERSION__: JSON.stringify(BUILD_ID),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/images': 'http://localhost:8000',
      '/class-docs': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
    },
  },
})
