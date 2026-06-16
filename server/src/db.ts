import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(path.join(DATA_DIR, 'askink.db'))

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    encrypted_key TEXT NOT NULL,
    key_hint TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`)

export interface UserRow {
  id: string
  email: string
  password_hash: string
  created_at: number
}

export interface ApiKeyRow {
  user_id: string
  encrypted_key: string
  key_hint: string
  updated_at: number
}

export const users = {
  create: db.prepare<[string, string, string, number]>(
    'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)'
  ),
  findByEmail: db.prepare<[string], UserRow>(
    'SELECT * FROM users WHERE email = ?'
  ),
  findById: db.prepare<[string], UserRow>(
    'SELECT * FROM users WHERE id = ?'
  ),
}

export const apiKeys = {
  upsert: db.prepare<[string, string, string, number]>(`
    INSERT INTO api_keys (user_id, encrypted_key, key_hint, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      encrypted_key = excluded.encrypted_key,
      key_hint = excluded.key_hint,
      updated_at = excluded.updated_at
  `),
  findByUser: db.prepare<[string], ApiKeyRow>(
    'SELECT * FROM api_keys WHERE user_id = ?'
  ),
  deleteByUser: db.prepare<[string]>(
    'DELETE FROM api_keys WHERE user_id = ?'
  ),
}

export default db
