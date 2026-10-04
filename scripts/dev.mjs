// API 서버(3000)와 Vite 개발 서버(5173)를 함께 실행 (추가 패키지 없음)
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const viteBin = join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js')
if (!existsSync(viteBin)) {
  console.error('vite를 찾을 수 없습니다. 먼저 npm install을 실행하세요.')
  process.exit(1)
}

const procs = [
  spawn(process.execPath, ['--watch', 'server/index.mjs'], { stdio: 'inherit' }),
  spawn(process.execPath, [viteBin], { stdio: 'inherit' }),
]

const stopAll = () => procs.forEach((p) => p.kill())
for (const p of procs) {
  p.on('exit', (code) => {
    if (code) {
      console.error(`[dev] 프로세스가 종료되었습니다 (code ${code}). 모두 중지합니다.`)
      stopAll()
      process.exit(code)
    }
  })
}
process.on('SIGINT', () => {
  stopAll()
  process.exit(0)
})
