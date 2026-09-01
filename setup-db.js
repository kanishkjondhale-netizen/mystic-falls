/* Bringing the database up to date: schema, then columns added later, then
 * the menu if it has never been loaded.
 *
 * Shared by `npm run init-db` and by the server on boot. Making the server do
 * this itself means deploying is enough — there is no separate "remember to
 * run the setup script against production" step to forget, which is exactly
 * the step that leaves a live site serving 500s.
 *
 * Every operation is idempotent, so running it on every boot is safe.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db, runSqlScript } from "./db.js";
import { MENU } from "./menu-data.js";

const here = dirname(fileURLToPath(import.meta.url));

/* Columns added after the first release. CREATE TABLE IF NOT EXISTS leaves an
   existing table alone, so these have to be applied by hand. */
const ADDED = {
  orders: {
    payment_mode: "TEXT", paid_at: "TEXT",
    payment_status: "TEXT NOT NULL DEFAULT 'unpaid'",
    rzp_order_id: "TEXT", rzp_payment_id: "TEXT",
    paid_cash: "INTEGER NOT NULL DEFAULT 0",
    paid_online: "INTEGER NOT NULL DEFAULT 0",
  },
  items: { descr: "TEXT" },
};

export async function ensureSchema({ log = () => {}, seed = "if-empty" } = {}) {
  const n = await runSqlScript(await readFile(join(here, "schema.sql"), "utf8"));
  log(`schema ready (${n} statements)`);

  for (const [table, cols] of Object.entries(ADDED)) {
    const info = await db.execute(`PRAGMA table_info(${table})`);
    const have = new Set(info.rows.map(r => r.name));
    for (const [col, type] of Object.entries(cols)) {
      if (have.has(col)) continue;
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
      log(`migrated: added ${table}.${col}`);
    }
  }
  await db.execute("CREATE INDEX IF NOT EXISTS idx_orders_rzp ON orders(rzp_order_id)");

  /* Orders recorded before split payments existed carry only a mode. */
  const a = await db.execute(`UPDATE orders SET paid_cash = total
     WHERE payment_mode = 'cash' AND paid_cash = 0 AND paid_online = 0`);
  const b = await db.execute(`UPDATE orders SET paid_online = total
     WHERE payment_mode IN ('phonepe','razorpay') AND paid_cash = 0 AND paid_online = 0`);
  if (a.rowsAffected || b.rowsAffected)
    log(`backfilled amounts on ${a.rowsAffected} cash and ${b.rowsAffected} online order(s)`);

  if (seed === "never") return { seeded: false };

  /* "if-empty" protects prices edited in /admin from being reset on every
     deploy; "always" is what `npm run init-db` uses to refresh the card. */
  if (seed === "if-empty") {
    const { rows } = await db.execute("SELECT COUNT(*) AS n FROM items");
    if (Number(rows[0].n) > 0) {
      log(`menu already loaded (${rows[0].n} items) — leaving prices alone`);
      return { seeded: false };
    }
  }

  let sections = 0, items = 0;
  for (const [si, sec] of MENU.entries()) {
    await db.execute({
      sql: `INSERT INTO sections (id, name, note, sized, sort) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET name=excluded.name, note=excluded.note,
              sized=excluded.sized, sort=excluded.sort`,
      args: [sec.id, sec.name, sec.note || null, sec.sized ? 1 : 0, si],
    });
    sections++;
    for (const [ii, it] of sec.items.entries()) {
      const p = it.prices || [];
      await db.execute({
        sql: `INSERT INTO items (id, section_id, name, qual, tag, descr, price, price_s, price_m, price_l, available, sort)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
              ON CONFLICT(id) DO UPDATE SET section_id=excluded.section_id, name=excluded.name,
                qual=excluded.qual, tag=excluded.tag, descr=excluded.descr, price=excluded.price,
                price_s=excluded.price_s, price_m=excluded.price_m, price_l=excluded.price_l,
                sort=excluded.sort`,
        args: [it.id, sec.id, it.name, it.qual || null, it.tag || null, it.descr || null,
               it.price ?? null, p[0] ?? null, p[1] ?? null, p[2] ?? null, ii],
      });
      items++;
    }
  }
  log(`menu loaded: ${sections} sections, ${items} items`);
  return { seeded: true, sections, items };
}
