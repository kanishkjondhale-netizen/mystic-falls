-- 0125 Mystic Falls Cafe — Turso schema

CREATE TABLE IF NOT EXISTS orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no     TEXT    NOT NULL,
  table_label  TEXT    NOT NULL,
  phone        TEXT,
  items_json   TEXT    NOT NULL,
  subtotal     INTEGER NOT NULL,
  gst          INTEGER NOT NULL DEFAULT 0,
  total        INTEGER NOT NULL,
  note         TEXT,
  status       TEXT    NOT NULL DEFAULT 'placed',
  placed_at    TEXT    NOT NULL,
  updated_at   TEXT,
  -- How it was settled. 'cash'/'phonepe' are recorded by staff at the counter;
  -- 'razorpay' is set by the server once a payment signature verifies.
  -- A label alone cannot describe "300 in cash, 200 on PhonePe", so the
  -- amounts are the real record and payment_mode is derived from them:
  -- 'cash' | 'phonepe' | 'razorpay' | 'split' | NULL when nothing is recorded.
  payment_mode   TEXT,
  paid_cash      INTEGER NOT NULL DEFAULT 0,
  paid_online    INTEGER NOT NULL DEFAULT 0,
  paid_at        TEXT,
  -- 'unpaid'  settle at the counter, the way it has always worked
  -- 'pending'  online checkout opened, money not confirmed, kitchen must NOT see it
  -- 'paid'     confirmed by signature or webhook
  -- 'failed'   customer abandoned or the gateway declined
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  rzp_order_id   TEXT,
  rzp_payment_id TEXT
);
-- The index on rzp_order_id is created by scripts/init-db.js instead: on a
-- database that predates these columns the table already exists, so the
-- column only appears after the migration step has run.
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_placed ON orders(placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone  ON orders(phone);

-- A customer pressing the bell. Kept in the database rather than in memory so
-- a staff device reloading mid-service does not lose a table that is waiting.
CREATE TABLE IF NOT EXISTS calls (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  table_label TEXT    NOT NULL,
  created_at  TEXT    NOT NULL,
  ack_at      TEXT                -- NULL while the table is still waiting
);
CREATE INDEX IF NOT EXISTS idx_calls_open ON calls(ack_at, created_at DESC);

-- One row per phone number waiting on a code. Replaced on every resend.
CREATE TABLE IF NOT EXISTS otps (
  phone      TEXT    PRIMARY KEY,
  code       TEXT    NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  sent_at    INTEGER NOT NULL
);

-- Built up automatically as orders land. Your repeat-customer list.
CREATE TABLE IF NOT EXISTS customers (
  phone        TEXT PRIMARY KEY,
  first_seen   TEXT,
  last_seen    TEXT,
  orders_count INTEGER NOT NULL DEFAULT 0,
  total_spend  INTEGER NOT NULL DEFAULT 0
);

-- The menu itself, so prices and sold-out flags change without a redeploy.
CREATE TABLE IF NOT EXISTS sections (
  id       TEXT PRIMARY KEY,
  name     TEXT    NOT NULL,
  note     TEXT,
  sized    INTEGER NOT NULL DEFAULT 0,
  sort     INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY,
  section_id  TEXT    NOT NULL REFERENCES sections(id),
  name        TEXT    NOT NULL,
  qual        TEXT,
  tag         TEXT,
  descr       TEXT,               -- one line: how it tastes, how it arrives
                                  -- NB: not "desc", which is a SQL keyword
  price       INTEGER,            -- plain items
  price_s     INTEGER,            -- sized items (small / medium / large)
  price_m     INTEGER,
  price_l     INTEGER,
  available   INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_items_section ON items(section_id, sort);
