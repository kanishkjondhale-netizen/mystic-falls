/* Confirms the app can actually reach its database and that the menu is loaded.
   Run it after filling in .env, and again on the host after deploying:
   it is the quickest way to tell a bad token apart from a bad URL apart from
   an empty database. Prints no secrets. */
import "dotenv/config";

const url = process.env.TURSO_DATABASE_URL || "";
const token = process.env.TURSO_AUTH_TOKEN || "";
const kind = url.startsWith("file:") ? "local SQLite file" : "Turso (remote)";

console.log(`\nDatabase : ${url ? url.replace(/^(libsql:\/\/[^.]{0,6})[^.]*/, "$1…") : "NOT SET"}  [${url ? kind : "-"}]`);
console.log(`Token    : ${token ? `present (${token.length} chars)` : "MISSING"}`);

/* db.js validates and exits the moment it is imported, so it is pulled in
   only after the settings look sane -- otherwise its terse message wins and
   none of the diagnostics below ever print. */
if (!url) {
  console.error("\nTURSO_DATABASE_URL is not set in .env.\n");
  process.exit(1);
}
if (!token) {
  console.error("\nTURSO_AUTH_TOKEN is empty in .env — paste your token on that line.\n");
  process.exit(1);
}
const { db } = await import("../db.js");

try {
  const t0 = Date.now();
  await db.execute("SELECT 1");
  console.log(`Reachable: yes (${Date.now() - t0}ms round trip)`);
} catch (e) {
  console.error(`\nCould not connect: ${e.message}`);
  console.error(
    /auth|401|unauthor/i.test(e.message)
      ? "The URL resolved but the token was rejected — check it was copied whole, and that it has not been revoked.\n"
      : "Check TURSO_DATABASE_URL, and that the database still exists in the Turso dashboard.\n"
  );
  process.exit(1);
}

const tables = ["sections", "items", "orders", "customers", "otps"];
const missing = [];
for (const t of tables) {
  try { await db.execute(`SELECT 1 FROM ${t} LIMIT 1`); }
  catch { missing.push(t); }
}
if (missing.length) {
  console.error(`\nTables not created yet: ${missing.join(", ")}`);
  console.error("Run:  npm run init-db\n");
  process.exit(1);
}

const one = async (sql) => Number((await db.execute(sql)).rows[0].n);
const sections = await one("SELECT COUNT(*) AS n FROM sections");
const items    = await one("SELECT COUNT(*) AS n FROM items");
const sold     = await one("SELECT COUNT(*) AS n FROM items WHERE available = 0");
const orders   = await one("SELECT COUNT(*) AS n FROM orders");
const custs    = await one("SELECT COUNT(*) AS n FROM customers");

console.log(`\nMenu     : ${sections} sections, ${items} items` +
            (sold ? `  (${sold} marked sold out)` : ""));
console.log(`Orders   : ${orders}`);
console.log(`Customers: ${custs}`);

const ok = sections === 18 && items === 101;
console.log(ok
  ? "\nAll good — the full menu is in the database.\n"
  : `\nExpected 18 sections and 101 items. Run 'npm run init-db' to load or refresh the menu.\n`);
process.exit(ok ? 0 : 1);
