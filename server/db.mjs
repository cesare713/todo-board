import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * 스키마 마이그레이션 (버전 순서대로 한 번씩만 적용)
 * 001: 기존 할 일 스키마 (PRD 데이터 모델)
 * 002: users / sessions 추가, tasks에 user_id 컬럼 추가
 */
export const MIGRATIONS = [
  {
    version: 1,
    name: 'create_tasks',
    sql: `
      CREATE TABLE tasks (
        id           TEXT PRIMARY KEY,
        title        TEXT NOT NULL,
        description  TEXT NOT NULL DEFAULT '',
        status       TEXT NOT NULL CHECK (status IN ('todo','doing','done')),
        period_type  TEXT NOT NULL CHECK (period_type IN ('daily','weekly','yearly')),
        period_value TEXT NOT NULL,
        "order"      REAL NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      );`,
  },
  {
    version: 2,
    name: 'add_users_sessions_and_task_user_id',
    sql: `
      CREATE TABLE users (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        github_id   INTEGER NOT NULL UNIQUE,
        username    TEXT NOT NULL,
        avatar_url  TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
      CREATE TABLE sessions (
        id          TEXT PRIMARY KEY,           -- 세션 토큰의 SHA-256 해시 (원본 토큰은 저장하지 않음)
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at  INTEGER NOT NULL,
        created_at  TEXT NOT NULL
      );
      CREATE INDEX idx_sessions_user ON sessions(user_id);
      ALTER TABLE tasks ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
      CREATE INDEX idx_tasks_user_period ON tasks(user_id, period_type, period_value);`,
  },
]

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
  migrate(db)
  return db
}

export function migrate(db, migrations = MIGRATIONS) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)`)
  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version))
  const record = db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
  for (const m of migrations) {
    if (applied.has(m.version)) continue
    db.exec('BEGIN')
    try {
      db.exec(m.sql)
      record.run(m.version, m.name, new Date().toISOString())
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw new Error(`마이그레이션 ${m.version}_${m.name} 실패: ${e.message}`)
    }
  }
}
