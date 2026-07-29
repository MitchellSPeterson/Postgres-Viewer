import { createServer } from "node:net";
import { spawn, type Subprocess } from "bun";

const API_PREFERRED = Number(process.env.API_PORT) || 3001;
const CLIENT_PREFERRED = Number(process.env.CLIENT_PORT) || 5173;

/** Prefer `preferred`, then walk upward; finally ask the OS for any free port. */
async function reservePort(preferred: number): Promise<number> {
  for (let port = preferred; port < preferred + 100; port++) {
    const available = await tryListen(port);
    if (available !== null) return available;
  }
  const fallback = await tryListen(0);
  if (fallback === null) throw new Error(`No open port found near ${preferred}`);
  return fallback;
}

function tryListen(port: number): Promise<number | null> {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolve(null));
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      const chosen =
        address && typeof address === "object" ? address.port : port;
      server.close(() => resolve(chosen));
    });
  });
}

const apiPort = await reservePort(API_PREFERRED);
const clientPort = await reservePort(CLIENT_PREFERRED);

const children: Subprocess[] = [];

function shutdown(code = 0) {
  for (const child of children) {
    try {
      child.kill();
    } catch {
      // already exited
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`
SQL Web Viewer (dev)
  API    http://127.0.0.1:${apiPort}
  Client http://127.0.0.1:${clientPort}
`);

const server = spawn({
  cmd: ["bun", "run", "--watch", "src/index.ts"],
  cwd: `${import.meta.dir}/../server`,
  stdout: "inherit",
  stderr: "inherit",
  env: {
    ...process.env,
    PORT: String(apiPort),
  },
});
children.push(server);

const client = spawn({
  cmd: [
    "bun",
    "run",
    "dev",
    "--",
    "--host",
    "127.0.0.1",
    "--port",
    String(clientPort),
    "--strictPort",
  ],
  cwd: `${import.meta.dir}/../client`,
  stdout: "inherit",
  stderr: "inherit",
  env: {
    ...process.env,
    API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
  },
});
children.push(client);

const codes = await Promise.all([server.exited, client.exited]);
const failed = codes.find((code) => code !== 0);
shutdown(failed ?? 0);
