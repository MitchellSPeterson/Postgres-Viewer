export type ConnectionConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
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

export type BrowseTable = {
  schema: string;
  name: string;
  columns: BrowseColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
  totalRows: number;
  truncated: boolean;
};

export type BrowseSuccess = {
  ok: true;
  tables: BrowseTable[];
  limit: number;
  durationMs: number;
};

export type ApiError = {
  ok: false;
  error: string;
};

export const DEFAULT_CONNECTION: ConnectionConfig = {
  host: "localhost",
  port: 5432,
  database: "postgres",
  username: "postgres",
  password: "",
};

export async function testConnection(
  config: ConnectionConfig,
): Promise<{ ok: true; message: string } | ApiError> {
  const res = await fetch("/api/test-connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function runQuery(
  config: ConnectionConfig,
  sql: string,
): Promise<QuerySuccess | ApiError> {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...config, sql }),
  });
  return res.json();
}

export async function browseTables(
  config: ConnectionConfig,
  limit?: number,
): Promise<BrowseSuccess | ApiError> {
  const res = await fetch("/api/browse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...config, ...(limit !== undefined ? { limit } : {}) }),
  });
  return res.json();
}
