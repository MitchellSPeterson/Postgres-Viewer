import {
  browseTarget,
  formatError,
  runTargetQuery,
  testTarget,
} from "./engines";
import {
  connectionLabel,
  deleteSavedConnection,
  isConnectionConfig,
  listSavedConnections,
  saveConnection,
  touchSavedConnection,
  type ConnectionConfig,
} from "./store";

const PORT = Number(process.env.PORT) || 3001;
const DEFAULT_BROWSE_LIMIT = 500;
const MAX_BROWSE_LIMIT = 5000;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function parseLimit(rawLimit: unknown): number | Response {
  if (rawLimit === undefined) return DEFAULT_BROWSE_LIMIT;
  if (typeof rawLimit !== "number" || !Number.isFinite(rawLimit) || rawLimit < 1) {
    return json({ ok: false, error: "limit must be a positive number" }, 400);
  }
  return Math.min(Math.floor(rawLimit), MAX_BROWSE_LIMIT);
}

function extractConfig(body: Record<string, unknown>): ConnectionConfig | null {
  // Accept either { config: {...} } or flat connection fields with engine
  if (body.config !== undefined) {
    return isConnectionConfig(body.config) ? body.config : null;
  }
  return isConnectionConfig(body) ? body : null;
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
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/connections") {
      return json({ ok: true, connections: listSavedConnections() });
    }

    if (req.method === "POST" && url.pathname === "/api/connections") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400);
      }
      if (!body || typeof body !== "object") {
        return json({ ok: false, error: "Invalid request body" }, 400);
      }

      const { name, ...rest } = body as Record<string, unknown>;
      if (typeof name !== "string" || !name.trim()) {
        return json({ ok: false, error: "Connection name is required" }, 400);
      }

      const config = extractConfig(rest);
      if (!config) {
        return json({ ok: false, error: "Missing or invalid connection fields" }, 400);
      }

      const saved = saveConnection(name, config);
      return json({ ok: true, connection: saved });
    }

    const connectionMatch = url.pathname.match(/^\/api\/connections\/(\d+)$/);
    if (connectionMatch) {
      const id = Number(connectionMatch[1]);
      if (req.method === "DELETE") {
        const deleted = deleteSavedConnection(id);
        if (!deleted) return json({ ok: false, error: "Connection not found" }, 404);
        return json({ ok: true });
      }
      if (req.method === "POST" && url.searchParams.get("touch") === "1") {
        const touched = touchSavedConnection(id);
        if (!touched) return json({ ok: false, error: "Connection not found" }, 404);
        return json({ ok: true, connection: touched });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/test-connection") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400);
      }

      const config =
        body && typeof body === "object"
          ? extractConfig(body as Record<string, unknown>)
          : null;
      if (!config) {
        return json({ ok: false, error: "Missing or invalid connection fields" }, 400);
      }

      try {
        await testTarget(config);
        return json({
          ok: true,
          message: `Connected successfully (${connectionLabel(config)})`,
        });
      } catch (err) {
        return json({ ok: false, error: formatError(err, "Connection failed") }, 400);
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

      const { sql: queryText, savedId, ...rest } = body as Record<string, unknown>;
      if (typeof queryText !== "string" || !queryText.trim()) {
        return json({ ok: false, error: "Query text is required" }, 400);
      }

      const config = extractConfig(rest);
      if (!config) {
        return json({ ok: false, error: "Missing or invalid connection fields" }, 400);
      }

      try {
        const result = await runTargetQuery(config, queryText);
        if (typeof savedId === "number") touchSavedConnection(savedId);
        return json({ ok: true, ...result });
      } catch (err) {
        return json({ ok: false, error: formatError(err, "Query failed") }, 400);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/browse") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400);
      }

      if (!body || typeof body !== "object") {
        return json({ ok: false, error: "Invalid request body" }, 400);
      }

      const { limit: rawLimit, savedId, ...rest } = body as Record<string, unknown>;
      const config = extractConfig(rest);
      if (!config) {
        return json({ ok: false, error: "Missing or invalid connection fields" }, 400);
      }

      const limitOrError = parseLimit(rawLimit);
      if (limitOrError instanceof Response) return limitOrError;

      try {
        const result = await browseTarget(config, limitOrError);
        if (typeof savedId === "number") touchSavedConnection(savedId);
        return json({ ok: true, ...result });
      } catch (err) {
        return json({ ok: false, error: formatError(err, "Browse failed") }, 400);
      }
    }

    return json({ error: "Not found" }, 404);
  },
});

console.log(`SQL Web Viewer API listening on http://localhost:${PORT}`);
