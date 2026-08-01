import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

export type Engine = "postgres" | "sqlite";

export type PostgresConfig = {
  engine: "postgres";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  /** Enable TLS (required for most AWS RDS instances). */
  ssl?: boolean;
};

export type SqliteConfig = {
  engine: "sqlite";
  path: string;
};

export type ConnectionConfig = PostgresConfig | SqliteConfig;

export type SavedConnection = {
  id: number;
  name: string;
  engine: Engine;
  config: ConnectionConfig;
  createdAt: number;
  lastUsedAt: number;
};

export type AppSettings = {
  darkMode: boolean;
  safeMode: boolean;
};

export type QueryHistoryItem = {
  id: number;
  sql: string;
  engine: Engine | null;
  connectionLabel: string | null;
  ok: boolean;
  error: string | null;
  rowCount: number | null;
  durationMs: number | null;
  createdAt: number;
};

export type Snippet = {
  id: number;
  name: string;
  sql: string;
  createdAt: number;
  updatedAt: number;
};

const DATA_DIR = path.join(import.meta.dir, "..", "data");
const DB_PATH = path.join(DATA_DIR, "connections.sqlite");
const HISTORY_LIMIT = 100;

mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH, { create: true });
db.exec(`
  CREATE TABLE IF NOT EXISTS saved_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    engine TEXT NOT NULL CHECK (engine IN ('postgres', 'sqlite')),
    config_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS query_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sql TEXT NOT NULL,
    engine TEXT,
    connection_label TEXT,
    ok INTEGER NOT NULL,
    error TEXT,
    row_count INTEGER,
    duration_ms INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS snippets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sql TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  safeMode: false,
};

type ConnRow = {
  id: number;
  name: string;
  engine: Engine;
  config_json: string;
  created_at: number;
  last_used_at: number;
};

function mapConnRow(row: ConnRow): SavedConnection {
  return {
    id: row.id,
    name: row.name,
    engine: row.engine,
    config: JSON.parse(row.config_json) as ConnectionConfig,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

export function listSavedConnections(): SavedConnection[] {
  const rows = db
    .query(
      `SELECT id, name, engine, config_json, created_at, last_used_at
       FROM saved_connections
       ORDER BY last_used_at DESC, id DESC`,
    )
    .all() as ConnRow[];
  return rows.map(mapConnRow);
}

export function getSavedConnection(id: number): SavedConnection | null {
  const row = db
    .query(
      `SELECT id, name, engine, config_json, created_at, last_used_at
       FROM saved_connections WHERE id = ?`,
    )
    .get(id) as ConnRow | null;
  return row ? mapConnRow(row) : null;
}

export function saveConnection(name: string, config: ConnectionConfig): SavedConnection {
  const now = Date.now();
  const result = db
    .query(
      `INSERT INTO saved_connections (name, engine, config_json, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id, name, engine, config_json, created_at, last_used_at`,
    )
    .get(name.trim(), config.engine, JSON.stringify(config), now, now) as ConnRow;
  return mapConnRow(result);
}

export function touchSavedConnection(id: number): SavedConnection | null {
  db.query(`UPDATE saved_connections SET last_used_at = ? WHERE id = ?`).run(
    Date.now(),
    id,
  );
  return getSavedConnection(id);
}

export function deleteSavedConnection(id: number): boolean {
  const result = db.query(`DELETE FROM saved_connections WHERE id = ?`).run(id);
  return result.changes > 0;
}

function readSetting(key: string): string | null {
  const row = db.query(`SELECT value FROM app_settings WHERE key = ?`).get(key) as
    | { value: string }
    | null;
  return row?.value ?? null;
}

function writeSetting(key: string, value: string): void {
  db.query(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

export function getSettings(): AppSettings {
  return {
    darkMode: readSetting("darkMode") === "1",
    safeMode: readSetting("safeMode") === "1",
  };
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  if (patch.darkMode !== undefined) {
    writeSetting("darkMode", patch.darkMode ? "1" : "0");
  }
  if (patch.safeMode !== undefined) {
    writeSetting("safeMode", patch.safeMode ? "1" : "0");
  }
  return getSettings();
}

export function addQueryHistory(entry: {
  sql: string;
  engine: Engine | null;
  connectionLabel: string | null;
  ok: boolean;
  error?: string | null;
  rowCount?: number | null;
  durationMs?: number | null;
}): QueryHistoryItem {
  const now = Date.now();
  const row = db
    .query(
      `INSERT INTO query_history
        (sql, engine, connection_label, ok, error, row_count, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id, sql, engine, connection_label, ok, error, row_count, duration_ms, created_at`,
    )
    .get(
      entry.sql,
      entry.engine,
      entry.connectionLabel,
      entry.ok ? 1 : 0,
      entry.error ?? null,
      entry.rowCount ?? null,
      entry.durationMs ?? null,
      now,
    ) as {
    id: number;
    sql: string;
    engine: Engine | null;
    connection_label: string | null;
    ok: number;
    error: string | null;
    row_count: number | null;
    duration_ms: number | null;
    created_at: number;
  };

  // Keep only the newest HISTORY_LIMIT rows.
  db.query(
    `DELETE FROM query_history
     WHERE id NOT IN (
       SELECT id FROM query_history ORDER BY created_at DESC, id DESC LIMIT ?
     )`,
  ).run(HISTORY_LIMIT);

  return {
    id: row.id,
    sql: row.sql,
    engine: row.engine,
    connectionLabel: row.connection_label,
    ok: row.ok === 1,
    error: row.error,
    rowCount: row.row_count,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  };
}

export function listQueryHistory(limit = 50): QueryHistoryItem[] {
  const rows = db
    .query(
      `SELECT id, sql, engine, connection_label, ok, error, row_count, duration_ms, created_at
       FROM query_history
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    id: number;
    sql: string;
    engine: Engine | null;
    connection_label: string | null;
    ok: number;
    error: string | null;
    row_count: number | null;
    duration_ms: number | null;
    created_at: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    sql: row.sql,
    engine: row.engine,
    connectionLabel: row.connection_label,
    ok: row.ok === 1,
    error: row.error,
    rowCount: row.row_count,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  }));
}

export function clearQueryHistory(): void {
  db.query(`DELETE FROM query_history`).run();
}

export function listSnippets(): Snippet[] {
  const rows = db
    .query(
      `SELECT id, name, sql, created_at, updated_at
       FROM snippets
       ORDER BY updated_at DESC, id DESC`,
    )
    .all() as Array<{
    id: number;
    name: string;
    sql: string;
    created_at: number;
    updated_at: number;
  }>;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sql: row.sql,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function saveSnippet(name: string, sql: string): Snippet {
  const now = Date.now();
  const row = db
    .query(
      `INSERT INTO snippets (name, sql, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       RETURNING id, name, sql, created_at, updated_at`,
    )
    .get(name.trim(), sql, now, now) as {
    id: number;
    name: string;
    sql: string;
    created_at: number;
    updated_at: number;
  };
  return {
    id: row.id,
    name: row.name,
    sql: row.sql,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function deleteSnippet(id: number): boolean {
  return db.query(`DELETE FROM snippets WHERE id = ?`).run(id).changes > 0;
}

/** True when SQL includes write/DDL statements that Safe Mode should block. */
export function isMutatingSql(sql: string): boolean {
  const cleaned = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .trim();
  if (!cleaned) return false;

  const statements = cleaned
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  const writeStart =
    /^(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE|COPY|CALL|DO|MERGE|VACUUM|REINDEX|ATTACH|DETACH)\b/i;

  return statements.some((stmt) => writeStart.test(stmt));
}

export function isPostgresConfig(value: unknown): value is PostgresConfig {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    c.engine === "postgres" &&
    typeof c.host === "string" &&
    typeof c.port === "number" &&
    Number.isFinite(c.port) &&
    typeof c.database === "string" &&
    typeof c.username === "string" &&
    typeof c.password === "string" &&
    (c.ssl === undefined || typeof c.ssl === "boolean")
  );
}

export function isSqliteConfig(value: unknown): value is SqliteConfig {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return c.engine === "sqlite" && typeof c.path === "string" && c.path.trim().length > 0;
}

export function isConnectionConfig(value: unknown): value is ConnectionConfig {
  return isPostgresConfig(value) || isSqliteConfig(value);
}

export function connectionLabel(config: ConnectionConfig): string {
  if (config.engine === "sqlite") return `sqlite:${config.path}`;
  return `${config.username}@${config.host}:${config.port}/${config.database}`;
}

export { DEFAULT_SETTINGS };
