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

export type QuerySuccess = {
  ok: true;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
};

export type BrowseColumn = {
  name: string;
  dataType: string;
  nullable: boolean;
};

export type BrowseTableMeta = {
  schema: string;
  name: string;
  columns: BrowseColumn[];
  primaryKey: string[];
};

export type BrowseTable = BrowseTableMeta & {
  rows: Record<string, unknown>[];
  rowCount: number;
  totalRows: number;
  truncated: boolean;
};

export type BrowseSuccess = {
  ok: true;
  tables: BrowseTableMeta[];
  durationMs: number;
};

export type TableRowsSuccess = {
  ok: true;
  schema: string;
  name: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  totalRows: number;
  truncated: boolean;
  limit: number;
  durationMs: number;
};

export type ApiError = {
  ok: false;
  error: string;
};

export const DEFAULT_POSTGRES: PostgresConfig = {
  engine: "postgres",
  host: "localhost",
  port: 5432,
  database: "postgres",
  username: "postgres",
  password: "",
};

export const DEFAULT_SQLITE: SqliteConfig = {
  engine: "sqlite",
  path: "",
};

export const DEFAULT_CONNECTION: ConnectionConfig = DEFAULT_POSTGRES;

export function connectionLabel(config: ConnectionConfig): string {
  if (config.engine === "sqlite") {
    return config.path ? `sqlite:${config.path}` : "sqlite:(no file)";
  }
  return `${config.username}@${config.host}:${config.port}/${config.database}`;
}

export function connectionKey(config: ConnectionConfig): string {
  if (config.engine === "sqlite") return `sqlite:${config.path}`;
  return `postgres:${config.username}@${config.host}:${config.port}/${config.database}`;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function testConnection(
  config: ConnectionConfig,
): Promise<{ ok: true; message: string } | ApiError> {
  return postJson("/api/test-connection", config);
}

export async function runQuery(
  config: ConnectionConfig,
  sql: string,
): Promise<QuerySuccess | ApiError> {
  return postJson("/api/query", { ...config, sql });
}

export async function browseTables(
  config: ConnectionConfig,
): Promise<BrowseSuccess | ApiError> {
  return postJson("/api/browse", config);
}

export async function fetchTableRows(
  config: ConnectionConfig,
  schema: string,
  table: string,
  limit = 100,
): Promise<TableRowsSuccess | ApiError> {
  return postJson("/api/table-rows", { ...config, schema, table, limit });
}

export async function updateTableCell(
  config: ConnectionConfig,
  args: {
    schema: string;
    table: string;
    column: string;
    value: unknown;
    primaryKey: Record<string, unknown>;
  },
): Promise<{ ok: true; changes: number } | ApiError> {
  return postJson("/api/update-cell", { ...config, ...args });
}

export async function listConnections(): Promise<
  { ok: true; connections: SavedConnection[] } | ApiError
> {
  const res = await fetch("/api/connections");
  return res.json();
}

export async function saveNamedConnection(
  name: string,
  config: ConnectionConfig,
): Promise<{ ok: true; connection: SavedConnection } | ApiError> {
  return postJson("/api/connections", { name, ...config });
}

export async function deleteConnection(
  id: number,
): Promise<{ ok: true } | ApiError> {
  const res = await fetch(`/api/connections/${id}`, { method: "DELETE" });
  return res.json();
}

export async function touchConnection(
  id: number,
): Promise<{ ok: true; connection: SavedConnection } | ApiError> {
  const res = await fetch(`/api/connections/${id}?touch=1`, { method: "POST" });
  return res.json();
}
