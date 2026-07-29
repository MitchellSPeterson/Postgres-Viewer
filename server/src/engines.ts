import { Database } from "bun:sqlite";
import { accessSync, constants } from "node:fs";
import postgres from "postgres";
import type { ConnectionConfig, PostgresConfig, SqliteConfig } from "./store";

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

export type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
};

export type BrowseResult = {
  tables: BrowseTable[];
  limit: number;
  durationMs: number;
};

export function formatError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  if (err.message) return err.message;
  if (err instanceof AggregateError && Array.isArray(err.errors) && err.errors.length > 0) {
    return err.errors
      .map((e) => (e instanceof Error && e.message ? e.message : String(e)))
      .join("; ");
  }
  const code = "code" in err && typeof err.code === "string" ? err.code : null;
  return code ? `${fallback} (${code})` : fallback;
}

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function createPostgres(config: PostgresConfig) {
  return postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
  });
}

function openSqlite(config: SqliteConfig, readonly = true): Database {
  const filePath = config.path.trim();
  try {
    accessSync(filePath, constants.R_OK);
  } catch {
    throw new Error(`SQLite file not found or unreadable: ${filePath}`);
  }
  return new Database(filePath, { readonly, create: false });
}

export async function testTarget(config: ConnectionConfig): Promise<void> {
  if (config.engine === "sqlite") {
    const db = openSqlite(config);
    try {
      db.query("SELECT 1 AS ok").get();
    } finally {
      db.close();
    }
    return;
  }

  const sql = createPostgres(config);
  try {
    await sql`SELECT 1 AS ok`;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export async function runTargetQuery(
  config: ConnectionConfig,
  queryText: string,
): Promise<QueryResult> {
  const started = performance.now();

  if (config.engine === "sqlite") {
    const db = openSqlite(config);
    try {
      const rows = db.query(queryText).all() as Record<string, unknown>[];
      const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];
      return {
        columns,
        rows,
        rowCount: rows.length,
        durationMs: Math.round(performance.now() - started),
      };
    } finally {
      db.close();
    }
  }

  const sql = createPostgres(config);
  try {
    const rows = await sql.unsafe(queryText);
    const columns =
      rows.length > 0
        ? Object.keys(rows[0] as Record<string, unknown>)
        : (rows.columns?.map((c: { name: string }) => c.name) ?? []);
    return {
      columns,
      rows: [...rows] as Record<string, unknown>[],
      rowCount: rows.count ?? rows.length,
      durationMs: Math.round(performance.now() - started),
    };
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export async function browseTarget(
  config: ConnectionConfig,
  limit: number,
): Promise<BrowseResult> {
  const started = performance.now();

  if (config.engine === "sqlite") {
    const db = openSqlite(config);
    try {
      const tableRows = db
        .query(
          `SELECT name AS table_name
           FROM sqlite_master
           WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
           ORDER BY name`,
        )
        .all() as Array<{ table_name: string }>;

      const tables: BrowseTable[] = [];
      for (const table of tableRows) {
        const name = table.table_name;
        const qualified = quoteIdent(name);
        const info = db.query(`PRAGMA table_info(${qualified})`).all() as Array<{
          name: string;
          type: string;
          notnull: number;
        }>;
        const columns: BrowseColumn[] = info.map((col) => ({
          name: col.name,
          dataType: col.type || "ANY",
          nullable: col.notnull === 0,
        }));

        const totalRows = Number(
          (
            db.query(`SELECT COUNT(*) AS count FROM ${qualified}`).get() as {
              count: number | bigint;
            }
          ).count,
        );

        const rows = db
          .query(`SELECT * FROM ${qualified} LIMIT ?`)
          .all(limit) as Record<string, unknown>[];

        tables.push({
          schema: "main",
          name,
          columns,
          rows,
          rowCount: rows.length,
          totalRows,
          truncated: totalRows > rows.length,
        });
      }

      return {
        tables,
        limit,
        durationMs: Math.round(performance.now() - started),
      };
    } finally {
      db.close();
    }
  }

  const sql = createPostgres(config);
  try {
    const tableRows = await sql`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `;

    const tables: BrowseTable[] = [];
    for (const table of tableRows) {
      const schema = String(table.table_schema);
      const name = String(table.table_name);
      const qualified = `${quoteIdent(schema)}.${quoteIdent(name)}`;

      const columnRows = await sql`
        SELECT column_name, data_type, is_nullable, ordinal_position
        FROM information_schema.columns
        WHERE table_schema = ${schema} AND table_name = ${name}
        ORDER BY ordinal_position
      `;

      const columns = columnRows.map((col) => ({
        name: String(col.column_name),
        dataType: String(col.data_type),
        nullable: col.is_nullable === "YES",
      }));

      const countResult = await sql.unsafe(`SELECT COUNT(*)::int AS count FROM ${qualified}`);
      const totalRows = Number(
        (countResult[0] as { count: number } | undefined)?.count ?? 0,
      );

      const data = await sql.unsafe(`SELECT * FROM ${qualified} LIMIT ${limit}`);
      const rows = [...data] as Record<string, unknown>[];
      const dataColumns =
        columns.length > 0
          ? columns.map((c) => c.name)
          : rows.length > 0
            ? Object.keys(rows[0]!)
            : (data.columns?.map((c: { name: string }) => c.name) ?? []);

      tables.push({
        schema,
        name,
        columns:
          columns.length > 0
            ? columns
            : dataColumns.map((colName) => ({
                name: colName,
                dataType: "unknown",
                nullable: true,
              })),
        rows,
        rowCount: rows.length,
        totalRows,
        truncated: totalRows > rows.length,
      });
    }

    return {
      tables,
      limit,
      durationMs: Math.round(performance.now() - started),
    };
  } finally {
    await sql.end({ timeout: 1 });
  }
}
