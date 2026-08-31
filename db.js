import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error(
    "\nMissing database settings.\n" +
    "Copy .env.example to .env and fill in TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.\n"
  );
  process.exit(1);
}

export const db = createClient({ url, authToken });

/** Run a .sql file split on semicolons — used by scripts/init-db.js. */
export async function runSqlScript(sql) {
  // Comments come out before the split, not after: a semicolon inside a
  // `-- comment` would otherwise chop a statement in half and the driver
  // reports it only as "incomplete input".
  const statements = sql
    .split("\n")
    .filter(line => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map(s => s.trim())
    .filter(Boolean);
  for (const stmt of statements) await db.execute(stmt);
  return statements.length;
}
