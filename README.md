# Postgres Web Viewer

Lightweight local alternative to pgAdmin: connect to PostgreSQL, run raw SQL, inspect results in a data grid.

## Stack

- **Bun** runtime + package manager
- **Bun.serve** API (`server/`) with **postgres.js**
- **Vite + React + Tailwind** UI (`client/`)

## Quick start

```bash
bun install
bun run dev:server   # http://localhost:3001
bun run dev:client   # http://localhost:5173
```

Open http://localhost:5173. Defaults assume a local Postgres (e.g. Apptainer): `localhost:5432`, user `postgres`.

## API

| Endpoint | Method | Body |
|----------|--------|------|
| `/api/test-connection` | POST | `{ host, port, database, username, password }` |
| `/api/query` | POST | connection fields + `{ sql }` |
| `/api/browse` | POST | connection fields + optional `{ limit }` (default 500, max 5000 rows per table) |
| `/api/health` | GET | — |

The **Browse Tables** view loads every user table (with columns + rows) so you can expand/collapse tables and hide columns for a dense overview.

Credentials are sent with each request and used only to open a short-lived connection; they are not stored on the server.

## Security note

For **local / internal use only**. There is no app auth — anyone who can reach the UI can run SQL with the credentials you enter.
