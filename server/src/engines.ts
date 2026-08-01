import { Database } from "bun:sqlite";
import { accessSync, constants } from "node:fs";
import postgres from "postgres";
import type { ConnectionConfig, PostgresConfig, SqliteConfig } from "./store";

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

export type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
};

export type BrowseMetaResult = {
  tables: BrowseTableMeta[];
  durationMs: number;
};

export type TableRowsResult = {
  schema: string;
  name: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  totalRows: number;
  truncated: boolean;
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
    // ponytail: 'require' covers AWS RDS without bundling the RDS CA bundle
    ssl: config.ssl ? "require" : false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
  });
}

function openSqlite(config: SqliteConfig, readonly = true): Database {
  const filePath = config.path.trim();
  try {
    accessSync(filePath, readonly ? constants.R_OK : constants.R_OK | constants.W_OK);
  } catch {
    throw new Error(
      readonly
        ? `SQLite file not found or unreadable: ${filePath}`
        : `SQLite file not found or not writable: ${filePath}`,
    );
  }
  // ponytail: bun:sqlite rejects `{ readonly: false }`; use readwrite for writes.
  return new Database(
    filePath,
    readonly ? { readonly: true, create: false } : { readwrite: true, create: false },
  );
}

function assertSafeIdent(name: string, label: string): string {
  if (!name || typeof name !== "string" || name.length > 256 || name.includes("\0")) {
    throw new Error(`Invalid ${label}`);
  }
  return name;
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

/** Fast path: table/column/PK metadata only — no row scans. */
export async function listTablesMeta(
  config: ConnectionConfig,
): Promise<BrowseMetaResult> {
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

      const tables: BrowseTableMeta[] = tableRows.map((table) => {
        const name = table.table_name;
        const info = db.query(`PRAGMA table_info(${quoteIdent(name)})`).all() as Array<{
          name: string;
          type: string;
          notnull: number;
          pk: number;
        }>;
        return {
          schema: "main",
          name,
          columns: info.map((col) => ({
            name: col.name,
            dataType: col.type || "ANY",
            nullable: col.notnull === 0,
          })),
          primaryKey: info
            .filter((col) => col.pk > 0)
            .sort((a, b) => a.pk - b.pk)
            .map((col) => col.name),
        };
      });

      return { tables, durationMs: Math.round(performance.now() - started) };
    } finally {
      db.close();
    }
  }

  const sql = createPostgres(config);
  try {
    // Batch metadata in 3 queries instead of ~3N round-trips per table.
    const tablesList = await sql`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `;

    const allColumns = await sql`
      SELECT table_schema, table_name, column_name, data_type, is_nullable, ordinal_position
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name, ordinal_position
    `;

    const allPks = await sql`
      SELECT tc.table_schema, tc.table_name, kcu.column_name, kcu.ordinal_position
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
       AND tc.table_name = kcu.table_name
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position
    `;

    const columnsByTable = new Map<string, BrowseColumn[]>();
    for (const col of allColumns) {
      const key = `${col.table_schema}.${col.table_name}`;
      const list = columnsByTable.get(key) ?? [];
      list.push({
        name: String(col.column_name),
        dataType: String(col.data_type),
        nullable: col.is_nullable === "YES",
      });
      columnsByTable.set(key, list);
    }

    const pkByTable = new Map<string, string[]>();
    for (const pk of allPks) {
      const key = `${pk.table_schema}.${pk.table_name}`;
      const list = pkByTable.get(key) ?? [];
      list.push(String(pk.column_name));
      pkByTable.set(key, list);
    }

    const tables: BrowseTableMeta[] = tablesList.map((table) => {
      const schema = String(table.table_schema);
      const name = String(table.table_name);
      const key = `${schema}.${name}`;
      return {
        schema,
        name,
        columns: columnsByTable.get(key) ?? [],
        primaryKey: pkByTable.get(key) ?? [],
      };
    });

    return { tables, durationMs: Math.round(performance.now() - started) };
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export async function fetchTableRows(
  config: ConnectionConfig,
  schema: string,
  table: string,
  limit: number,
): Promise<TableRowsResult> {
  const started = performance.now();
  const safeSchema = assertSafeIdent(schema, "schema");
  const safeTable = assertSafeIdent(table, "table");

  if (config.engine === "sqlite") {
    const db = openSqlite(config);
    try {
      const qualified = quoteIdent(safeTable);
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
      return {
        schema: "main",
        name: safeTable,
        rows,
        rowCount: rows.length,
        totalRows,
        truncated: totalRows > rows.length,
        limit,
        durationMs: Math.round(performance.now() - started),
      };
    } finally {
      db.close();
    }
  }

  const sql = createPostgres(config);
  try {
    const qualified = `${quoteIdent(safeSchema)}.${quoteIdent(safeTable)}`;
    const countResult = await sql.unsafe(`SELECT COUNT(*)::int AS count FROM ${qualified}`);
    const totalRows = Number(
      (countResult[0] as { count: number } | undefined)?.count ?? 0,
    );
    const data = await sql.unsafe(`SELECT * FROM ${qualified} LIMIT ${limit}`);
    const rows = [...data] as Record<string, unknown>[];
    return {
      schema: safeSchema,
      name: safeTable,
      rows,
      rowCount: rows.length,
      totalRows,
      truncated: totalRows > rows.length,
      limit,
      durationMs: Math.round(performance.now() - started),
    };
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export type UpdateCellInput = {
  schema: string;
  table: string;
  column: string;
  value: unknown;
  primaryKey: Record<string, unknown>;
};

export async function updateCell(
  config: ConnectionConfig,
  input: UpdateCellInput,
): Promise<{ changes: number }> {
  const schema = assertSafeIdent(input.schema, "schema");
  const table = assertSafeIdent(input.table, "table");
  const column = assertSafeIdent(input.column, "column");
  const pkEntries = Object.entries(input.primaryKey);
  if (pkEntries.length === 0) {
    throw new Error("Primary key is required to update a cell");
  }
  for (const [key] of pkEntries) {
    assertSafeIdent(key, "primary key column");
  }

  if (config.engine === "sqlite") {
    const db = openSqlite(config, false);
    try {
      const qualified = quoteIdent(table);
      const setClause = `${quoteIdent(column)} = ?`;
      const whereClause = pkEntries
        .map(([key], i) => {
          const val = pkEntries[i]![1];
          return val === null || val === undefined
            ? `${quoteIdent(key)} IS NULL`
            : `${quoteIdent(key)} = ?`;
        })
        .join(" AND ");
      const params: unknown[] = [input.value];
      for (const [, val] of pkEntries) {
        if (val !== null && val !== undefined) params.push(val);
      }
      const result = db
        .query(`UPDATE ${qualified} SET ${setClause} WHERE ${whereClause}`)
        .run(...params);
      if (result.changes === 0) {
        throw new Error("No rows updated — primary key may not match");
      }
      return { changes: result.changes };
    } finally {
      db.close();
    }
  }

  const sql = createPostgres(config);
  try {
    const qualified = `${quoteIdent(schema)}.${quoteIdent(table)}`;
    const setClause = `${quoteIdent(column)} = $1`;
    const whereParts: string[] = [];
    const params: unknown[] = [input.value];
    let paramIndex = 2;
    for (const [key, val] of pkEntries) {
      if (val === null || val === undefined) {
        whereParts.push(`${quoteIdent(key)} IS NULL`);
      } else {
        whereParts.push(`${quoteIdent(key)} = $${paramIndex}`);
        params.push(val);
        paramIndex += 1;
      }
    }
    const query = `UPDATE ${qualified} SET ${setClause} WHERE ${whereParts.join(" AND ")}`;
    const result = await sql.unsafe(query, params);
    const changes = result.count ?? 0;
    if (changes === 0) {
      throw new Error("No rows updated — primary key may not match");
    }
    return { changes };
  } finally {
    await sql.end({ timeout: 1 });
  }
}
