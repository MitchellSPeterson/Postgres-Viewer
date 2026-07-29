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

const DATA_DIR = path.join(import.meta.dir, "..", "data");
const DB_PATH = path.join(DATA_DIR, "connections.sqlite");

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
`);

type Row = {
  id: number;
  name: string;
  engine: Engine;
  config_json: string;
  created_at: number;
  last_used_at: number;
};

function mapRow(row: Row): SavedConnection {
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
    .all() as Row[];
  return rows.map(mapRow);
}

export function getSavedConnection(id: number): SavedConnection | null {
  const row = db
    .query(
      `SELECT id, name, engine, config_json, created_at, last_used_at
       FROM saved_connections WHERE id = ?`,
    )
    .get(id) as Row | null;
  return row ? mapRow(row) : null;
}

export function saveConnection(name: string, config: ConnectionConfig): SavedConnection {
  const now = Date.now();
  const result = db
    .query(
      `INSERT INTO saved_connections (name, engine, config_json, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id, name, engine, config_json, created_at, last_used_at`,
    )
    .get(name.trim(), config.engine, JSON.stringify(config), now, now) as Row;
  return mapRow(result);
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
    typeof c.password === "string"
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
