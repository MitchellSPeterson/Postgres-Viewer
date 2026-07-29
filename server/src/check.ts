/**
 * ponytail: assert-based self-check for request validation helpers.
 * Ceiling: does not spin up Bun.serve or talk to Postgres.
 */
function isConnectionConfig(value: unknown): boolean {
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

const good = {
  host: "localhost",
  port: 5432,
  database: "postgres",
  username: "postgres",
  password: "secret",
};

console.assert(isConnectionConfig(good) === true, "valid config rejected");
console.assert(isConnectionConfig({ ...good, port: "5432" }) === false, "string port accepted");
console.assert(isConnectionConfig({ ...good, host: 1 }) === false, "non-string host accepted");
console.assert(isConnectionConfig(null) === false, "null accepted");
console.assert(isConnectionConfig({}) === false, "empty object accepted");

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

console.assert(quoteIdent("users") === '"users"', "simple ident");
console.assert(quoteIdent('weird"name') === '"weird""name"', "escaped quote");

console.log("server check ok");
