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
