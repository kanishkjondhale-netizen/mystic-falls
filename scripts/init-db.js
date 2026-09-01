/* Creates the tables and refreshes the printed menu in the database.
   Safe to run more than once: tables use IF NOT EXISTS and menu rows are
   upserted, so re-running refreshes names, descriptions and prices without
   touching orders or the sold-out flags you have set.

   Note the difference from what the server does on boot: this always
   rewrites the menu from menu-data.js, so it will overwrite prices edited
   in /admin. The server only seeds when the table is empty. */
import "dotenv/config";
import { db } from "../db.js";
import { ensureSchema } from "../setup-db.js";

const r = await ensureSchema({ log: m => console.log("  " + m), seed: "always" });

const { rows } = await db.execute("SELECT COUNT(*) AS c FROM orders");
console.log(`  orders table holds ${rows[0].c} order(s).`);
console.log(r.seeded ? "\nDone." : "\nDone (menu unchanged).");
process.exit(0);
