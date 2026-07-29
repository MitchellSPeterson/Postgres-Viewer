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
bun run dev:server   # http://localhost:3001
bun run dev:client   # http://localhost:5173
```

Open http://localhost:5173.

- **PostgreSQL** defaults assume a local instance (e.g. Apptainer): `localhost:5432`, user `postgres`
- **SQLite** accepts an absolute file path on the machine running the Bun server

## Features

- Query editor with Cmd/Ctrl+Enter
- Browse Tables view (collapse tables / hide columns)
- Save and reopen past connections (including passwords for local convenience)
- Inspect SQLite `.db` / `.sqlite` files via bun:sqlite

## API

| Endpoint | Method | Body |
|----------|--------|------|
| `/api/test-connection` | POST | connection config (`engine: "postgres" \| "sqlite"`) |
| `/api/query` | POST | connection config + `{ sql }` |
| `/api/browse` | POST | connection config + optional `{ limit }` |
| `/api/connections` | GET | list saved connections |
| `/api/connections` | POST | `{ name, ...config }` |
| `/api/connections/:id` | DELETE | delete saved connection |
| `/api/health` | GET | — |

Postgres config: `{ engine:"postgres", host, port, database, username, password }`  
SQLite config: `{ engine:"sqlite", path }`

## Security note

For **local / internal use only**. There is no app auth. Saved credentials live in a local SQLite file on the server machine (`server/data/`).
