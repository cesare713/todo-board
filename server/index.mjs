import { createServer } from 'node:http'
import { resolve } from 'node:path'

const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Node.js 22.13 이상이 필요합니다 (현재 ${process.versions.node}). 내장 SQLite(node:sqlite)를 사용합니다.`)
  process.exit(1)
}

const { loadConfig, assertOAuthConfigured } = await import('./config.mjs')
const { openDatabase } = await import('./db.mjs')
const { createApp } = await import('./app.mjs')

const config = loadConfig()
const missing = assertOAuthConfigured(config)
if (missing.length) {
  console.warn(`[경고] .env에 ${missing.join(', ')} 값이 없습니다. GitHub 로그인이 동작하지 않습니다. (.env.example 참고)`)
}

const db = openDatabase(config.databasePath)
const app = createApp({ db, config, staticDir: resolve(process.cwd(), 'dist') })

createServer(app).listen(config.port, () => {
  console.log(`API 서버: http://localhost:${config.port}`)
  console.log(`앱 주소(APP_URL): ${config.appUrl}`)
  console.log(`GitHub OAuth 콜백 URL: ${config.callbackUrl}`)
  console.log(`DB: ${config.databasePath}`)
})
