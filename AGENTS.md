# AGENTS.md

## Cursor Cloud specific instructions

This repo is a Bun workspace (`postgres-web-viewer`) with a `server/` (Bun.serve API) and `client/` (Vite + React) package. Standard commands live in the root `package.json` and `README.md`; prefer those. Notes below are non-obvious things for running it in this cloud environment.

### Bun on PATH
- `bun` is installed under `~/.bun/bin` and is only on `PATH` in login shells (it's added via `~/.bashrc`). In a plain non-interactive `bash -c`, `bun` is NOT found. Run commands with `bash -lc '...'` or call `~/.bun/bin/bun` directly. The startup update script already runs `~/.bun/bin/bun install`.

### PostgreSQL (required for end-to-end use)
- PostgreSQL 16 is installed but NOT auto-started (the update script does not start services). Start it with: `sudo pg_ctlcluster 16 main start`.
- The `postgres` role password has been set to `postgres`, reachable over TCP at `localhost:5432` (password auth works). A `demo_users` table (id, name, email) exists in the `postgres` database for quick end-to-end testing.
- The app never stores DB credentials server-side: they are entered in the UI and sent per-request. So there is no `.env`/DB config to set for the server; you just need a reachable Postgres and the credentials to type into the UI.

### Running the two services
- API: `bun run dev:server` → http://localhost:3001 (set `PORT` to override). Health check: `GET /api/health`.
- UI: `bun run dev:client` → http://localhost:5173 (Vite proxies `/api` → `:3001`, hardcoded in `client/vite.config.ts`).
- Start the API before/independently of the UI; the UI relies on the proxy target being up for `/api` calls.

### Lint / check / build
- See `package.json` scripts: `bun run check` (server self-check + client build), `bun run --cwd client lint` (oxlint), `bun run build` (client `tsc -b && vite build`). No DB is needed for any of these.
