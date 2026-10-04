import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/** .env를 읽고 설정을 만든다. CLIENT_SECRET은 코드에 두지 않고 환경 변수로만 받는다. */
export function loadConfig(env = process.env, { envFile = resolve(process.cwd(), '.env') } = {}) {
  if (env === process.env && existsSync(envFile)) process.loadEnvFile(envFile)

  const appUrl = (env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '')
  return {
    githubClientId: env.GITHUB_CLIENT_ID || '',
    githubClientSecret: env.GITHUB_CLIENT_SECRET || '',
    appUrl,
    appOrigin: new URL(appUrl).origin,
    callbackUrl: `${appUrl}/auth/github/callback`,
    port: Number(env.PORT || 3000),
    databasePath: env.DATABASE_PATH || resolve(process.cwd(), 'data', 'todo.db'),
    sessionTtlMs: Number(env.SESSION_TTL_DAYS || 7) * 24 * 60 * 60 * 1000,
    cookieSecure: appUrl.startsWith('https://'),
  }
}

export function assertOAuthConfigured(config) {
  const missing = []
  if (!config.githubClientId) missing.push('GITHUB_CLIENT_ID')
  if (!config.githubClientSecret) missing.push('GITHUB_CLIENT_SECRET')
  return missing
}
