# SQL Web Viewer

Lightweight local alternative to pgAdmin: connect to PostgreSQL or open SQLite files, run raw SQL, and browse table data.

## Stack

- **Bun** runtime + package manager
- **Bun.serve** API (`server/`) with **postgres.js** + **bun:sqlite**
- **Vite + React + Tailwind** UI (`client/`)
- Saved connections stored locally in `server/data/connections.sqlite`

## Quick start

```bash
bun install
bun run dev
```

That one command starts the API and Vite client together. It picks the first open ports near `3001` (API) and `5173` (client), wires the Vite `/api` proxy to the API port, and prints both URLs.

Optional overrides:

```bash
API_PORT=3010 CLIENT_PORT=5180 bun run dev
```

Or run processes separately:

```bash
bun run dev:server   # http://localhost:3001
bun run dev:client   # http://localhost:5173
```

- **PostgreSQL** defaults assume a local instance (e.g. Apptainer): `localhost:5432`, user `postgres`
- **SQLite** accepts an absolute file path on the machine running the Bun server

## Features

- Query editor with Cmd/Ctrl+Enter
- Browse Tables view (collapse tables / hide columns; double-click cells to edit when a primary key exists; right-click to copy raw values with newlines preserved)
- Save and reopen past connections (including passwords for local convenience)
- Inspect SQLite `.db` / `.sqlite` files via bun:sqlite

## API

| Endpoint | Method | Body |
|----------|--------|------|
| `/api/test-connection` | POST | connection config (`engine: "postgres" \| "sqlite"`) |
| `/api/query` | POST | connection config + `{ sql }` |
| `/api/browse` | POST | connection config + optional `{ limit }` |
| `/api/update-cell` | POST | connection config + `{ schema, table, column, value, primaryKey }` |
| `/api/connections` | GET | list saved connections |
| `/api/connections` | POST | `{ name, ...config }` |
| `/api/connections/:id` | DELETE | delete saved connection |
| `/api/health` | GET | — |

Postgres config: `{ engine:"postgres", host, port, database, username, password }`  
SQLite config: `{ engine:"sqlite", path }`

## Security note

For **local / internal use only**. There is no app auth. Saved credentials live in a local SQLite file on the server machine (`server/data/`).
