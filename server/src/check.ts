/**
 * ponytail: assert-based self-check for connection validators + sqlite quote helper.
 * Ceiling: does not spin up Bun.serve or talk to Postgres.
 */
import { Database } from "bun:sqlite";
import {
  isConnectionConfig,
  isMutatingSql,
  isPostgresConfig,
  isSqliteConfig,
} from "./store";

const goodPg = {
  engine: "postgres" as const,
  host: "localhost",
  port: 5432,
  database: "postgres",
  username: "postgres",
  password: "secret",
};

const goodSqlite = {
  engine: "sqlite" as const,
  path: "/tmp/demo.db",
};

console.assert(isPostgresConfig(goodPg) === true, "valid pg rejected");
console.assert(
  isPostgresConfig({ ...goodPg, ssl: true }) === true,
  "pg with ssl rejected",
);
console.assert(
  isPostgresConfig({ ...goodPg, ssl: "true" }) === false,
  "string ssl accepted",
);
console.assert(isSqliteConfig(goodSqlite) === true, "valid sqlite rejected");
console.assert(isConnectionConfig(goodPg) === true, "pg union rejected");
console.assert(isConnectionConfig(goodSqlite) === true, "sqlite union rejected");
console.assert(
  isPostgresConfig({ ...goodPg, port: "5432" }) === false,
  "string port accepted",
);
console.assert(isSqliteConfig({ engine: "sqlite", path: "" }) === false, "empty path accepted");
console.assert(isConnectionConfig({}) === false, "empty object accepted");
console.assert(isMutatingSql("SELECT 1") === false, "select flagged");
console.assert(isMutatingSql("UPDATE users SET x=1") === true, "update missed");
console.assert(isMutatingSql("/* c */ DELETE FROM t") === true, "delete missed");
console.assert(isMutatingSql("SELECT 1; DROP TABLE t") === true, "multi missed");

// Create a tiny sqlite file and browse-ish query it
const demoPath = `/tmp/pgviewer-check-${Date.now()}.sqlite`;
const demo = new Database(demoPath, { create: true });
demo.exec(`CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT);`);
demo.exec(`INSERT INTO items (name) VALUES ('alpha'), ('beta');`);
const rows = demo.query("SELECT id, name FROM items ORDER BY id").all() as Array<{
  id: number;
  name: string;
}>;
demo.close();
console.assert(rows.length === 2 && rows[0]?.name === "alpha", "sqlite demo query failed");

console.log("server check ok");
