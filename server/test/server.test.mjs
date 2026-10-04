// 실행: npm run test:server  (node --test, 추가 패키지 없음)
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, beforeEach, describe, it } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { createApp } from '../app.mjs'
import { loadConfig } from '../config.mjs'
import { MIGRATIONS, migrate, openDatabase } from '../db.mjs'

const config = loadConfig(
  { GITHUB_CLIENT_ID: 'test-client-id', GITHUB_CLIENT_SECRET: 'test-secret', APP_URL: 'http://localhost:5173' },
  {},
)

// ---- GitHub 모의 ----
const githubUsers = {
  'code-alice': { id: 101, login: 'alice', avatar_url: 'https://avatars.example/alice.png' },
  'code-bob': { id: 202, login: 'bob', avatar_url: 'https://avatars.example/bob.png' },
}
const githubCalls = []
async function fakeFetch(url, init = {}) {
  githubCalls.push({ url: String(url), init })
  if (String(url) === 'https://github.com/login/oauth/access_token') {
    const body = JSON.parse(init.body)
    if (body.client_secret !== 'test-secret') return Response.json({ error: 'bad_secret' })
    if (!githubUsers[body.code]) return Response.json({ error: 'bad_verification_code' })
    return Response.json({ access_token: `token-${body.code}` })
  }
  if (String(url) === 'https://api.github.com/user') {
    const code = init.headers.Authorization.replace('Bearer token-', '')
    return Response.json(githubUsers[code])
  }
  throw new Error('unexpected fetch ' + url)
}

let db, server, base

before(async () => {
  db = openDatabase(':memory:')
  server = createServer(createApp({ db, config, fetch: fakeFetch }))
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => server.close())
beforeEach(() => {
  db.exec('DELETE FROM tasks; DELETE FROM sessions; DELETE FROM users;')
  githubCalls.length = 0
})

// ---- 도우미 ----
const getCookie = (res, name) => {
  const c = res.headers.getSetCookie().find((h) => h.startsWith(name + '='))
  return c ? c.split(';')[0] : null
}

async function login(code = 'code-alice') {
  const start = await fetch(`${base}/auth/github`, { redirect: 'manual' })
  const state = new URL(start.headers.get('location')).searchParams.get('state')
  const stateCookie = getCookie(start, 'oauth_state')
  const cb = await fetch(`${base}/auth/github/callback?code=${code}&state=${state}`, {
    redirect: 'manual',
    headers: { cookie: stateCookie },
  })
  return { res: cb, sid: getCookie(cb, 'sid') }
}

const api = (sid, path, { method = 'GET', body, headers = {} } = {}) =>
  fetch(base + path, {
    method,
    headers: {
      ...(sid ? { cookie: sid } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      'x-requested-with': 'fetch',
      origin: 'http://localhost:5173',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

const task = (id, extra = {}) => ({
  id,
  title: `할 일 ${id}`,
  description: '',
  status: 'todo',
  period_type: 'weekly',
  period_value: '2026-09-28',
  order: 0,
  created_at: '2026-10-04T00:00:00.000Z',
  updated_at: '2026-10-04T00:00:00.000Z',
  ...extra,
})

// ---- 테스트 ----
describe('마이그레이션', () => {
  it('기존 tasks 스키마(001)에 데이터가 있어도 user_id 컬럼이 추가된다', () => {
    const legacy = new DatabaseSync(':memory:')
    migrate(legacy, MIGRATIONS.slice(0, 1))
    legacy.prepare(`INSERT INTO tasks (id,title,description,status,period_type,period_value,"order",created_at,updated_at)
      VALUES ('old','기존','', 'todo','daily','2026-10-04',0,'x','x')`).run()
    migrate(legacy)
    const cols = legacy.prepare('PRAGMA table_info(tasks)').all().map((c) => c.name)
    assert.ok(cols.includes('user_id'))
    assert.equal(legacy.prepare('SELECT title FROM tasks WHERE id = ?').get('old').title, '기존')
    const versions = legacy.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((r) => r.version)
    assert.deepEqual(versions, [1, 2])
    migrate(legacy) // 두 번 실행해도 안전
  })
})

describe('GitHub OAuth', () => {
  it('/auth/github → GitHub 인증 페이지로 리다이렉트 + state 쿠키', async () => {
    const res = await fetch(`${base}/auth/github`, { redirect: 'manual' })
    assert.equal(res.status, 302)
    const loc = new URL(res.headers.get('location'))
    assert.equal(loc.origin + loc.pathname, 'https://github.com/login/oauth/authorize')
    assert.equal(loc.searchParams.get('client_id'), 'test-client-id')
    assert.equal(loc.searchParams.get('redirect_uri'), 'http://localhost:5173/auth/github/callback')
    assert.ok(loc.searchParams.get('state'))
    assert.ok(!res.headers.get('location').includes('test-secret'), '시크릿이 URL에 노출되면 안 됨')
    assert.match(res.headers.getSetCookie().join(), /oauth_state=.*HttpOnly/)
  })

  it('콜백: 로그인 성공 시 username·avatar_url 저장 + 세션 쿠키', async () => {
    const { res, sid } = await login()
    assert.equal(res.status, 302)
    assert.equal(res.headers.get('location'), 'http://localhost:5173/')
    assert.ok(sid)
    const user = db.prepare('SELECT github_id, username, avatar_url FROM users').get()
    assert.deepEqual({ ...user }, { github_id: 101, username: 'alice', avatar_url: 'https://avatars.example/alice.png' })
    const me = await (await api(sid, '/api/me')).json()
    assert.equal(me.user.username, 'alice')
    // 세션 원본 토큰은 DB에 저장하지 않음
    const stored = db.prepare('SELECT id FROM sessions').get().id
    assert.notEqual(stored, decodeURIComponent(sid.split('=')[1]))
  })

  it('재로그인 시 사용자 정보 갱신 (중복 생성 없음)', async () => {
    await login()
    githubUsers['code-alice'].avatar_url = 'https://avatars.example/alice-new.png'
    await login()
    const rows = db.prepare('SELECT avatar_url FROM users').all()
    assert.equal(rows.length, 1)
    assert.equal(rows[0].avatar_url, 'https://avatars.example/alice-new.png')
  })

  it('state 불일치 → 로그인 거부', async () => {
    const res = await fetch(`${base}/auth/github/callback?code=code-alice&state=forged`, {
      redirect: 'manual',
      headers: { cookie: 'oauth_state=other' },
    })
    assert.equal(res.headers.get('location'), 'http://localhost:5173/?login_error=invalid_state')
    assert.equal(getCookie(res, 'sid'), null)
    assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n, 0)
  })

  it('사용자가 GitHub에서 거부 / 잘못된 code → 오류로 복귀', async () => {
    const denied = await fetch(`${base}/auth/github/callback?error=access_denied`, { redirect: 'manual' })
    assert.match(denied.headers.get('location'), /login_error=access_denied/)
    const { res } = await login('code-unknown')
    assert.match(res.headers.get('location'), /login_error=github_error/)
  })

  it('CLIENT 설정이 없으면 로그인 시작 불가', async () => {
    const empty = loadConfig({}, {})
    const s = createServer(createApp({ db, config: empty, fetch: fakeFetch }))
    await new Promise((r) => s.listen(0, r))
    const res = await fetch(`http://127.0.0.1:${s.address().port}/auth/github`, { redirect: 'manual' })
    assert.equal(res.status, 500)
    assert.match((await res.json()).error, /GITHUB_CLIENT_ID/)
    s.close()
  })
})

describe('접근 제어', () => {
  it('로그인 안 하면 401', async () => {
    for (const [method, path, body] of [
      ['GET', '/api/me'],
      ['GET', '/api/tasks'],
      ['POST', '/api/tasks', task('x')],
      ['PUT', '/api/tasks/x', task('x')],
      ['DELETE', '/api/tasks/x'],
    ]) {
      const res = await api(null, path, { method, body })
      assert.equal(res.status, 401, `${method} ${path}`)
    }
  })

  it('본인 할 일만 조회/수정/삭제', async () => {
    const alice = (await login('code-alice')).sid
    const bob = (await login('code-bob')).sid

    assert.equal((await api(alice, '/api/tasks', { method: 'POST', body: task('a1') })).status, 201)
    assert.equal((await api(bob, '/api/tasks', { method: 'POST', body: task('b1') })).status, 201)

    const aliceList = (await (await api(alice, '/api/tasks')).json()).tasks.map((t) => t.id)
    assert.deepEqual(aliceList, ['a1'])

    // bob이 alice 할 일 수정/삭제 시도 → 404, 데이터 그대로
    assert.equal((await api(bob, '/api/tasks/a1', { method: 'PUT', body: task('a1', { title: '탈취' }) })).status, 404)
    assert.equal((await api(bob, '/api/tasks/a1', { method: 'DELETE' })).status, 404)
    assert.equal(db.prepare('SELECT title FROM tasks WHERE id = ?').get('a1').title, '할 일 a1')

    // 본인은 가능
    const put = await api(alice, '/api/tasks/a1', { method: 'PUT', body: task('a1', { title: '수정됨', status: 'done' }) })
    assert.equal(put.status, 200)
    assert.equal(db.prepare('SELECT title, status FROM tasks WHERE id = ?').get('a1').status, 'done')
    assert.equal((await api(alice, '/api/tasks/a1', { method: 'DELETE' })).status, 204)
    assert.equal(db.prepare('SELECT COUNT(*) n FROM tasks WHERE user_id IS NOT NULL').get().n, 1)
  })

  it('남의 id로 생성 시도 → 409 (덮어쓰기 불가)', async () => {
    const alice = (await login('code-alice')).sid
    const bob = (await login('code-bob')).sid
    await api(alice, '/api/tasks', { method: 'POST', body: task('same') })
    assert.equal((await api(bob, '/api/tasks', { method: 'POST', body: task('same') })).status, 409)
  })

  it('입력 검증: 잘못된 상태·주간 값(월요일 아님) 거부', async () => {
    const sid = (await login()).sid
    assert.equal((await api(sid, '/api/tasks', { method: 'POST', body: task('v1', { status: 'x' }) })).status, 400)
    assert.equal((await api(sid, '/api/tasks', { method: 'POST', body: task('v2', { period_value: '2026-10-01' }) })).status, 400)
  })

  it('CSRF: 다른 출처나 헤더 없는 변경 요청 거부', async () => {
    const sid = (await login()).sid
    assert.equal((await api(sid, '/api/tasks', { method: 'POST', body: task('c1'), headers: { origin: 'https://evil.example' } })).status, 403)
    assert.equal((await api(sid, '/api/tasks', { method: 'POST', body: task('c2'), headers: { 'x-requested-with': '' } })).status, 403)
  })

  it('로컬 할 일 가져오기: 본인 계정에 저장, 잘못된 항목은 건너뜀', async () => {
    const sid = (await login()).sid
    const res = await api(sid, '/api/tasks/import', { method: 'POST', body: { tasks: [task('l1'), task('l2'), { bad: 1 }] } })
    assert.deepEqual(await res.json(), { imported: 2, skipped: 1 })
    assert.equal((await (await api(sid, '/api/tasks')).json()).tasks.length, 2)
  })
})

describe('로그아웃', () => {
  it('세션 행 삭제 + 쿠키 삭제, 이후 401', async () => {
    const { sid } = await login()
    assert.equal(db.prepare('SELECT COUNT(*) n FROM sessions').get().n, 1)
    const res = await api(sid, '/auth/logout', { method: 'POST' })
    assert.equal(res.status, 204)
    assert.match(res.headers.getSetCookie().join(), /sid=;.*Max-Age=0/)
    assert.equal(db.prepare('SELECT COUNT(*) n FROM sessions').get().n, 0)
    // 이전 쿠키를 다시 보내도 거부
    assert.equal((await api(sid, '/api/tasks')).status, 401)
  })

  it('만료된 세션은 거부', async () => {
    const { sid } = await login()
    db.prepare('UPDATE sessions SET expires_at = 0').run()
    assert.equal((await api(sid, '/api/me')).status, 401)
  })
})
