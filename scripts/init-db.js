/* Creates the tables and loads the printed menu into the database.
   Safe to run more than once: tables use IF NOT EXISTS and menu rows
   are upserted, so re-running refreshes names and prices without
   touching orders or the sold-out flags you have set. */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db, runSqlScript } from "../db.js";
import { MENU } from "../menu-data.js";

const here = dirname(fileURLToPath(import.meta.url));

const n = await runSqlScript(await readFile(join(here, "..", "schema.sql"), "utf8"));
console.log(`Schema ready (${n} statements).`);

/* CREATE TABLE IF NOT EXISTS leaves an existing table alone, so columns added
   to schema.sql after a database was first created have to be applied by hand.
   Safe to run repeatedly: it only adds what is missing. */
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
for (const [table, cols] of Object.entries(ADDED)) {
  const info = await db.execute(`PRAGMA table_info(${table})`);
  const have = new Set(info.rows.map(r => r.name));
  for (const [col, type] of Object.entries(cols)) {
    if (have.has(col)) continue;
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    console.log(`  migrated: added ${table}.${col}`);
  }
}
/* Only safe once the column above definitely exists. */
await db.execute("CREATE INDEX IF NOT EXISTS idx_orders_rzp ON orders(rzp_order_id)");

/* Orders recorded before split payments existed carry only a mode. Give them
   amounts to match, so historical takings still add up per method. */
const back = await db.execute(
  `UPDATE orders SET paid_cash = total
     WHERE payment_mode = 'cash' AND paid_cash = 0 AND paid_online = 0`);
const back2 = await db.execute(
  `UPDATE orders SET paid_online = total
     WHERE payment_mode IN ('phonepe','razorpay') AND paid_cash = 0 AND paid_online = 0`);
if (back.rowsAffected || back2.rowsAffected)
  console.log(`  backfilled amounts on ${back.rowsAffected} cash and ${back2.rowsAffected} online order(s).`);

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
console.log(`Menu loaded: ${sections} sections, ${items} items.`);

const { rows } = await db.execute("SELECT COUNT(*) AS c FROM orders");
console.log(`Orders table holds ${rows[0].c} order(s). Done.`);
process.exit(0);
