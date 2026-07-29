import postgres from "postgres";

const PORT = Number(process.env.PORT) || 3001;

type ConnectionConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
};

function isConnectionConfig(value: unknown): value is ConnectionConfig {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.host === "string" &&
    typeof c.port === "number" &&
    Number.isFinite(c.port) &&
    typeof c.database === "string" &&
    typeof c.username === "string" &&
    typeof c.password === "string"
  );
}

function createSql(config: ConnectionConfig) {
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

function formatError(err: unknown, fallback: string): string {
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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/test-connection") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400);
      }

      if (!isConnectionConfig(body)) {
        return json({ ok: false, error: "Missing or invalid connection fields" }, 400);
      }

      const sql = createSql(body);
      try {
        await sql`SELECT 1 AS ok`;
        return json({ ok: true, message: "Connected successfully" });
      } catch (err) {
        return json({ ok: false, error: formatError(err, "Connection failed") }, 400);
      } finally {
        await sql.end({ timeout: 1 });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/query") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400);
      }

      if (!body || typeof body !== "object") {
        return json({ ok: false, error: "Invalid request body" }, 400);
      }

      const { sql: queryText, ...rest } = body as Record<string, unknown>;
      if (typeof queryText !== "string" || !queryText.trim()) {
        return json({ ok: false, error: "Query text is required" }, 400);
      }
      if (!isConnectionConfig(rest)) {
        return json({ ok: false, error: "Missing or invalid connection fields" }, 400);
      }

      const sql = createSql(rest);
      const started = performance.now();
      try {
        // Unsafe by design: this is a raw SQL viewer for trusted local use.
        const rows = await sql.unsafe(queryText);
        const durationMs = Math.round(performance.now() - started);
        const columns =
          rows.length > 0
            ? Object.keys(rows[0] as Record<string, unknown>)
            : (rows.columns?.map((c: { name: string }) => c.name) ?? []);

        return json({
          ok: true,
          columns,
          rows,
          rowCount: rows.count ?? rows.length,
          durationMs,
        });
      } catch (err) {
        return json({ ok: false, error: formatError(err, "Query failed") }, 400);
      } finally {
        await sql.end({ timeout: 1 });
      }
    }

    return json({ error: "Not found" }, 404);
  },
});

console.log(`Postgres Web Viewer API listening on http://localhost:${PORT}`);
