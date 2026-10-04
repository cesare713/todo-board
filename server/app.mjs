import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { assertOAuthConfigured } from './config.mjs'
import { buildAuthorizeUrl, exchangeCodeForToken, fetchGithubUser } from './github.mjs'
import { validateTask } from './validate.mjs'

const SESSION_COOKIE = 'sid'
const STATE_COOKIE = 'oauth_state'
const MAX_BODY = 1024 * 1024
const TASK_COLUMNS = `id, title, description, status, period_type, period_value, "order", created_at, updated_at`

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const hashToken = (token) => createHash('sha256').update(token).digest('hex')

function parseCookies(header = '') {
  const out = {}
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function cookie(name, value, { maxAge, path = '/', secure }) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAge / 1000)}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

const clearCookie = (name, path, secure) => cookie(name, '', { maxAge: 0, path, secure })

function safeEqual(a, b) {
  const ab = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  res.end(body === undefined ? '' : JSON.stringify(body))
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store', ...headers })
  res.end()
}

async function readJson(req) {
  if (!String(req.headers['content-type'] || '').includes('application/json')) {
    throw new HttpError(415, 'Content-Type은 application/json이어야 합니다.')
  }
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw new HttpError(413, '요청이 너무 큽니다.')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')
  } catch {
    throw new HttpError(400, 'JSON 형식이 올바르지 않습니다.')
  }
}

/**
 * @param {{ db: import('node:sqlite').DatabaseSync, config: ReturnType<import('./config.mjs').loadConfig>, fetch?: typeof fetch, staticDir?: string, now?: () => number }} deps
 */
export function createApp({ db, config, fetch: fetchImpl = fetch, staticDir, now = () => Date.now() }) {
  const q = {
    upsertUser: db.prepare(`
      INSERT INTO users (github_id, username, avatar_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(github_id) DO UPDATE SET
        username = excluded.username, avatar_url = excluded.avatar_url, updated_at = excluded.updated_at
      RETURNING id`),
    insertSession: db.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'),
    findSession: db.prepare(`
      SELECT u.id AS id, u.username AS username, u.avatar_url AS avatar_url
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ?`),
    deleteSession: db.prepare('DELETE FROM sessions WHERE id = ?'),
    deleteExpired: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    listTasks: db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE user_id = ? ORDER BY period_type, period_value, status, "order"`),
    taskExists: db.prepare('SELECT 1 FROM tasks WHERE id = ?'),
    insertTask: db.prepare(`INSERT INTO tasks (${TASK_COLUMNS}, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    updateTask: db.prepare(`
      UPDATE tasks SET title = ?, description = ?, status = ?, period_type = ?, period_value = ?,
        "order" = ?, updated_at = ?
      WHERE id = ? AND user_id = ?`),
    deleteTask: db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?'),
  }

  const insertTask = (t, userId) =>
    q.insertTask.run(t.id, t.title, t.description, t.status, t.period_type, t.period_value, t.order, t.created_at, t.updated_at, userId)

  function currentUser(req) {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    if (!token) return null
    return q.findSession.get(hashToken(token), now()) ?? null
  }

  function requireUser(req) {
    const user = currentUser(req)
    if (!user) throw new HttpError(401, '로그인이 필요합니다.')
    return user
  }

  /** CSRF 방어: 상태를 바꾸는 요청은 같은 출처 + 커스텀 헤더 필수 */
  function assertSameOrigin(req) {
    const origin = req.headers.origin
    if (origin && origin !== config.appOrigin) throw new HttpError(403, '허용되지 않은 출처입니다.')
    if (req.headers['x-requested-with'] !== 'fetch') throw new HttpError(403, '잘못된 요청입니다.')
  }

  // ---------- 인증 라우트 ----------

  function startLogin(res) {
    const missing = assertOAuthConfigured(config)
    if (missing.length) {
      return sendJson(res, 500, { error: `서버 설정 누락: ${missing.join(', ')} (.env 확인)` })
    }
    const state = randomBytes(24).toString('base64url')
    redirect(res, buildAuthorizeUrl(config, state), {
      'Set-Cookie': cookie(STATE_COOKIE, state, { maxAge: 10 * 60 * 1000, path: '/auth', secure: config.cookieSecure }),
    })
  }

  async function finishLogin(req, res, url) {
    const clearState = clearCookie(STATE_COOKIE, '/auth', config.cookieSecure)
    const fail = (reason) => redirect(res, `${config.appUrl}/?login_error=${encodeURIComponent(reason)}`, { 'Set-Cookie': clearState })

    if (url.searchParams.get('error')) return fail(url.searchParams.get('error'))
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const savedState = parseCookies(req.headers.cookie)[STATE_COOKIE]
    if (!code || !state || !savedState || !safeEqual(state, savedState)) return fail('invalid_state')

    let gh
    try {
      const token = await exchangeCodeForToken(config, code, fetchImpl)
      gh = await fetchGithubUser(token, fetchImpl) // 액세스 토큰은 저장하지 않음
    } catch (e) {
      console.error('[auth]', e.message)
      return fail('github_error')
    }

    const ts = new Date(now()).toISOString()
    const { id: userId } = q.upsertUser.get(gh.githubId, gh.username, gh.avatarUrl, ts, ts)
    const sessionToken = randomBytes(32).toString('base64url')
    q.deleteExpired.run(now())
    q.insertSession.run(hashToken(sessionToken), userId, now() + config.sessionTtlMs, ts)

    redirect(res, `${config.appUrl}/`, {
      'Set-Cookie': [
        clearState,
        cookie(SESSION_COOKIE, sessionToken, { maxAge: config.sessionTtlMs, secure: config.cookieSecure }),
      ],
    })
  }

  function logout(req, res) {
    assertSameOrigin(req)
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    if (token) q.deleteSession.run(hashToken(token))
    sendJson(res, 204, undefined, { 'Set-Cookie': clearCookie(SESSION_COOKIE, '/', config.cookieSecure) })
  }

  // ---------- 할 일 API (본인 것만) ----------

  async function tasksApi(req, res, url) {
    const user = requireUser(req)
    const method = req.method
    const idMatch = /^\/api\/tasks\/([^/]+)$/.exec(url.pathname)
    if (method !== 'GET') assertSameOrigin(req)

    if (url.pathname === '/api/tasks' && method === 'GET') {
      return sendJson(res, 200, { tasks: q.listTasks.all(user.id).map(toTask) })
    }

    if (url.pathname === '/api/tasks' && method === 'POST') {
      const { task, error } = validateTask(await readJson(req))
      if (error) throw new HttpError(400, error)
      if (q.taskExists.get(task.id)) throw new HttpError(409, '이미 존재하는 id입니다.')
      insertTask(task, user.id)
      return sendJson(res, 201, { task })
    }

    if (url.pathname === '/api/tasks/import' && method === 'POST') {
      const body = await readJson(req)
      if (!Array.isArray(body?.tasks) || body.tasks.length > 5000) throw new HttpError(400, 'tasks 배열이 필요합니다.')
      const imported = []
      db.exec('BEGIN')
      try {
        for (const raw of body.tasks) {
          const { task } = validateTask(raw)
          if (!task) continue // 형식이 잘못된 항목은 건너뜀
          if (q.taskExists.get(task.id)) task.id = randomUUID()
          insertTask(task, user.id)
          imported.push(task)
        }
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
      return sendJson(res, 200, { imported: imported.length, skipped: body.tasks.length - imported.length })
    }

    if (idMatch && method === 'PUT') {
      const id = decodeURIComponent(idMatch[1])
      const body = await readJson(req)
      const { task, error } = validateTask({ ...body, id })
      if (error) throw new HttpError(400, error)
      const r = q.updateTask.run(task.title, task.description, task.status, task.period_type, task.period_value, task.order, task.updated_at, id, user.id)
      if (r.changes === 0) throw new HttpError(404, '할 일을 찾을 수 없습니다.')
      return sendJson(res, 200, { task })
    }

    if (idMatch && method === 'DELETE') {
      const r = q.deleteTask.run(decodeURIComponent(idMatch[1]), user.id)
      if (r.changes === 0) throw new HttpError(404, '할 일을 찾을 수 없습니다.')
      return sendJson(res, 204)
    }

    throw new HttpError(404, '없는 경로입니다.')
  }

  // ---------- 정적 파일 (npm run build 결과) ----------

  function serveStatic(req, res, url) {
    if (!staticDir || !existsSync(staticDir) || (req.method !== 'GET' && req.method !== 'HEAD')) return false
    const root = resolve(staticDir)
    let file = normalize(join(root, decodeURIComponent(url.pathname)))
    if (!file.startsWith(root)) return false
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html')
    if (!existsSync(file)) return false
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' })
    res.end(req.method === 'HEAD' ? undefined : readFileSync(file))
    return true
  }

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost')
    try {
      if (url.pathname === '/auth/github' && req.method === 'GET') return startLogin(res)
      if (url.pathname === '/auth/github/callback' && req.method === 'GET') return await finishLogin(req, res, url)
      if (url.pathname === '/auth/logout' && req.method === 'POST') return logout(req, res)
      if (url.pathname === '/api/me' && req.method === 'GET') {
        const user = requireUser(req)
        return sendJson(res, 200, { user })
      }
      if (url.pathname === '/api/tasks' || url.pathname.startsWith('/api/tasks/')) return await tasksApi(req, res, url)
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) throw new HttpError(404, '없는 경로입니다.')
      if (serveStatic(req, res, url)) return
      throw new HttpError(404, 'Not Found')
    } catch (e) {
      if (e instanceof HttpError) return sendJson(res, e.status, { error: e.message })
      console.error('[server]', e)
      return sendJson(res, 500, { error: '서버 오류가 발생했습니다.' })
    }
  }
}

function toTask(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    period_type: row.period_type,
    period_value: row.period_value,
    order: row.order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
