import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db } from "./db.js";
import { CAFE } from "./menu-data.js";
import { sendOtpSms, smsMode } from "./sms.js";

const here = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const GST_PERCENT = Number(process.env.GST_PERCENT || 0);
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "unset-secret";

app.disable("x-powered-by");
/* Railway, Render, Fly and any nginx in front all terminate TLS and forward.
   Without this every request carries the proxy's address, so req.ip would be
   identical for every customer and the per-IP OTP limit would throttle the
   whole cafe at once. Also lets req.secure see the original https. */
app.set("trust proxy", 1);
/* The webhook signature is computed over the exact bytes Razorpay sent, so the
   raw body has to be kept before JSON.parse reformats it. */
app.use(express.json({ limit: "64kb", verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(cookieParser());

/* ---------------------------------------------------------------- helpers */
const nowIso = () => new Date().toISOString();
const validPhone = p => /^[6-9]\d{9}$/.test(String(p || ""));
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

/* A tiny in-memory rate limiter. Good enough for one cafe; if you ever run
   more than one server process, move this to the database. */
const hits = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || now > rec.reset) { hits.set(key, { n: 1, reset: now + windowMs }); return true; }
  if (rec.n >= max) return false;
  rec.n++;
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
}, 60_000).unref();

/* ---------------------------------------------------------------- razorpay */
/* Talks to the REST API directly rather than pulling in the SDK -- the surface
   used here is one endpoint, and the signature maths is a few lines of crypto.
   With no keys configured the whole feature switches off and the app behaves
   exactly as it did before: everyone pays at the counter. */
const RZP_KEY    = () => process.env.RAZORPAY_KEY_ID || "";
const RZP_SECRET = () => process.env.RAZORPAY_KEY_SECRET || "";
const RZP_HOOK   = () => process.env.RAZORPAY_WEBHOOK_SECRET || "";
const onlinePayEnabled = () => Boolean(RZP_KEY() && RZP_SECRET());

async function rzpCreateOrder({ amountPaise, receipt, notes }) {
  const auth = Buffer.from(`${RZP_KEY()}:${RZP_SECRET()}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt, notes,
                           payment_capture: 1 }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.description || `Razorpay refused the order (${res.status})`);
  return body;
}

const hmacHex = (data, secret) => crypto.createHmac("sha256", secret).update(data).digest("hex");

/* Timing-safe compare that cannot throw on a length mismatch. */
function sameSignature(a, b) {
  const A = Buffer.from(String(a || ""), "utf8"), B = Buffer.from(String(b || ""), "utf8");
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

/* Marks an order paid exactly once, whichever of the two routes gets there
   first -- the browser callback or the webhook. */
async function markPaid(rzpOrderId, rzpPaymentId) {
  const r = await db.execute({
    sql: `UPDATE orders
             SET payment_status='paid', payment_mode='razorpay', rzp_payment_id=?,
                 paid_online=total, paid_cash=0,
                 paid_at=?, status = CASE WHEN status='pending_payment' THEN 'placed' ELSE status END,
                 updated_at=?
           WHERE rzp_order_id=? AND payment_status!='paid'`,
    args: [rzpPaymentId, nowIso(), nowIso(), rzpOrderId],
  });
  return r.rowsAffected > 0;
}

/* ------------------------------------------------------------ staff login */
function staffToken() {
  return crypto.createHmac("sha256", SESSION_SECRET).update("staff:" + STAFF_PASSWORD).digest("hex");
}
function isStaff(req) {
  return Boolean(STAFF_PASSWORD) && req.cookies?.mf_staff === staffToken();
}
function requireStaff(req, res, next) {
  if (isStaff(req)) return next();
  return bad(res, "Staff login required.", 401);
}

app.post("/api/staff/login", (req, res) => {
  if (!STAFF_PASSWORD) return bad(res, "No staff password is set on the server.", 500);
  if (!rateLimit("login:" + req.ip, 10, 5 * 60_000)) return bad(res, "Too many attempts. Wait five minutes.", 429);
  const given = String(req.body?.password || "");
  const ok = given.length === STAFF_PASSWORD.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(STAFF_PASSWORD));
  if (!ok) return bad(res, "Wrong password.", 401);
  res.cookie("mf_staff", staffToken(), {
    httpOnly: true, sameSite: "lax", maxAge: 30 * 24 * 3600 * 1000,
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
  });
  res.json({ ok: true });
});
app.post("/api/staff/logout", (req, res) => { res.clearCookie("mf_staff"); res.json({ ok: true }); });
app.get("/api/staff/me", (req, res) => res.json({ staff: isStaff(req) }));

/* ------------------------------------------------------------------- menu */
app.get("/api/menu", async (_req, res) => {
  try {
    const [secs, items] = await Promise.all([
      db.execute("SELECT * FROM sections ORDER BY sort"),
      db.execute("SELECT * FROM items ORDER BY sort"),
    ]);
    const bySection = new Map();
    for (const r of items.rows) {
      if (!bySection.has(r.section_id)) bySection.set(r.section_id, []);
      const item = {
        id: r.id, name: r.name, available: !!r.available,
        ...(r.qual ? { qual: r.qual } : {}),
        ...(r.tag ? { tag: r.tag } : {}),
        ...(r.descr ? { descr: r.descr } : {}),
      };
      if (r.price_s != null) item.prices = [r.price_s, r.price_m, r.price_l];
      else item.price = r.price;
      bySection.get(r.section_id).push(item);
    }
    const menu = secs.rows.map(s => ({
      id: s.id, name: s.name,
      ...(s.note ? { note: s.note } : {}),
      ...(s.sized ? { sized: true, sizeLabels: ["Small", "Medium", "Large"] } : {}),
      items: bySection.get(s.id) || [],
    })).filter(s => s.items.length);
    res.json({ cafe: CAFE, gstPercent: GST_PERCENT, menu, onlinePay: onlinePayEnabled() });
  } catch (e) {
    console.error("GET /api/menu", e);
    bad(res, "Could not load the menu.", 500);
  }
});

/* Staff: change a price, or mark something sold out. */
app.patch("/api/menu/item/:id", requireStaff, async (req, res) => {
  const { price, prices, available } = req.body || {};
  const sets = [], args = [];
  const int = v => (v === null || v === "" || v === undefined ? null : Math.max(0, Math.round(Number(v))));
  if (price !== undefined) { sets.push("price = ?"); args.push(int(price)); }
  if (Array.isArray(prices)) {
    sets.push("price_s = ?", "price_m = ?", "price_l = ?");
    args.push(int(prices[0]), int(prices[1]), int(prices[2]));
  }
  if (available !== undefined) { sets.push("available = ?"); args.push(available ? 1 : 0); }
  if (!sets.length) return bad(res, "Nothing to change.");
  args.push(req.params.id);
  try {
    await db.execute({ sql: `UPDATE items SET ${sets.join(", ")} WHERE id = ?`, args });
    res.json({ ok: true });
  } catch (e) { console.error(e); bad(res, "Could not save that change.", 500); }
});

/* -------------------------------------------------------------------- otp */
app.post("/api/otp/send", async (req, res) => {
  const phone = String(req.body?.phone || "").replace(/\D/g, "");
  if (!validPhone(phone)) return bad(res, "Enter a 10-digit mobile number starting with 6, 7, 8 or 9.");
  if (!rateLimit("otp:" + phone, 5, 15 * 60_000)) return bad(res, "Too many codes requested. Try again in a few minutes.", 429);
  if (!rateLimit("otpip:" + req.ip, 20, 15 * 60_000)) return bad(res, "Too many requests from this connection.", 429);

  const code = String(crypto.randomInt(100000, 1000000));
  const expires = Date.now() + 5 * 60_000;
  try {
    await db.execute({
      sql: `INSERT INTO otps (phone, code, expires_at, attempts, sent_at) VALUES (?, ?, ?, 0, ?)
            ON CONFLICT(phone) DO UPDATE SET code=excluded.code, expires_at=excluded.expires_at,
              attempts=0, sent_at=excluded.sent_at`,
      args: [phone, code, expires, Date.now()],
    });
    const out = await sendOtpSms(phone, code);
    res.json({ ok: true, mode: smsMode(), ...(out.demoCode ? { demoCode: out.demoCode } : {}) });
  } catch (e) {
    console.error("POST /api/otp/send", e);
    bad(res, "Could not send the code right now.", 502);
  }
});

app.post("/api/otp/verify", async (req, res) => {
  const phone = String(req.body?.phone || "").replace(/\D/g, "");
  const code = String(req.body?.code || "").replace(/\D/g, "");
  if (!validPhone(phone) || code.length !== 6) return bad(res, "Enter all six digits.");
  try {
    const { rows } = await db.execute({ sql: "SELECT * FROM otps WHERE phone = ?", args: [phone] });
    const rec = rows[0];
    if (!rec) return bad(res, "Ask for a code first.");
    if (Date.now() > Number(rec.expires_at)) return bad(res, "That code has expired. Tap Resend.");
    if (Number(rec.attempts) >= 5) return bad(res, "Too many wrong tries. Tap Resend for a new code.", 429);
    if (String(rec.code) !== code) {
      await db.execute({ sql: "UPDATE otps SET attempts = attempts + 1 WHERE phone = ?", args: [phone] });
      return bad(res, "That code is wrong. Check and try again.");
    }
    await db.execute({ sql: "DELETE FROM otps WHERE phone = ?", args: [phone] });
    const token = crypto.createHmac("sha256", SESSION_SECRET).update("phone:" + phone).digest("hex");
    res.cookie("mf_phone", phone, { sameSite: "lax", maxAge: 180 * 24 * 3600 * 1000 });
    res.cookie("mf_ptok", token, { httpOnly: true, sameSite: "lax", maxAge: 180 * 24 * 3600 * 1000,
      secure: req.secure || req.headers["x-forwarded-proto"] === "https" });
    res.json({ ok: true, phone });
  } catch (e) {
    console.error("POST /api/otp/verify", e);
    bad(res, "Could not check that code.", 500);
  }
});

function verifiedPhone(req) {
  const phone = req.cookies?.mf_phone, tok = req.cookies?.mf_ptok;
  if (!phone || !tok) return null;
  const expect = crypto.createHmac("sha256", SESSION_SECRET).update("phone:" + phone).digest("hex");
  return tok === expect ? phone : null;
}
/* Without a verified phone, "is this your order?" needs another answer. The
   browser that placed an order gets a signed list of its own order ids, so it
   can follow its own status and nobody else's. */
const ordersTokenFor = ids =>
  crypto.createHmac("sha256", SESSION_SECRET).update("orders:" + ids.join(",")).digest("hex");

function ownedOrderIds(req) {
  const raw = req.cookies?.mf_mine, tok = req.cookies?.mf_minetok;
  if (!raw || !tok) return [];
  const ids = raw.split(",").filter(Boolean);
  return ordersTokenFor(ids) === tok ? ids : [];
}
function rememberOrder(req, res, id) {
  const ids = [...new Set([...ownedOrderIds(req), String(id)])].slice(-25);  /* a night's worth */
  const opts = { sameSite: "lax", maxAge: 30 * 24 * 3600 * 1000,
                 secure: req.secure || req.headers["x-forwarded-proto"] === "https" };
  res.cookie("mf_mine", ids.join(","), opts);
  res.cookie("mf_minetok", ordersTokenFor(ids), { ...opts, httpOnly: true });
}

app.get("/api/me", (req, res) => res.json({ phone: verifiedPhone(req) }));

/* ----------------------------------------------------------------- orders */
const rowToOrder = r => ({
  id: r.id, no: r.order_no, table: r.table_label, phone: r.phone || "",
  items: JSON.parse(r.items_json), subtotal: r.subtotal, gst: r.gst, total: r.total,
  note: r.note || "", status: r.status, placedAt: r.placed_at,
  paymentMode: r.payment_mode || null, paidAt: r.paid_at || null,
  paidCash: Number(r.paid_cash || 0), paidOnline: Number(r.paid_online || 0),
  paymentStatus: r.payment_status || "unpaid",
});
const PAY_MODES = ["cash", "phonepe"];

async function bumpCustomer(phone, total, whenIso) {
  if (!phone) return;          /* the regulars list is keyed on the number */
  await db.execute({
    sql: `INSERT INTO customers (phone, first_seen, last_seen, orders_count, total_spend)
          VALUES (?, ?, ?, 1, ?)
          ON CONFLICT(phone) DO UPDATE SET last_seen=excluded.last_seen,
            orders_count=customers.orders_count+1, total_spend=customers.total_spend+excluded.total_spend`,
    args: [phone, whenIso, whenIso, total],
  });
}

app.post("/api/orders", async (req, res) => {
  /* A number is useful, not compulsory. The customer is sitting at a numbered
     table in the room — that, not a verified phone, is the accountability.
     A verified number (if OTP is ever switched back on) still wins over one
     that was merely typed. */
  const verified = verifiedPhone(req);
  const typed = String(req.body?.phone || "").replace(/\D/g, "").slice(0, 10);
  const phone = verified || (/^[6-9]\d{9}$/.test(typed) ? typed : "");
  if (typed && !phone) return bad(res, "That mobile number does not look right. Leave it blank to skip.");

  const table = String(req.body?.table || "").slice(0, 40);
  /* Without a phone to key on, the table is the next best handle, and the
     connection behind it the one after that. */
  const limitKey = phone ? "order:" + phone : "ordertable:" + table + ":" + req.ip;
  if (!rateLimit(limitKey, 12, 10 * 60_000))
    return bad(res, "That is a lot of orders in a row. Please call a server.", 429);
  const lines = Array.isArray(req.body?.items) ? req.body.items : [];
  const note = String(req.body?.note || "").slice(0, 400);
  if (!table) return bad(res, "Pick your table first.");
  if (!lines.length || lines.length > 60) return bad(res, "Your order is empty.");

  try {
    /* Price server-side from the database — never trust the numbers the
       browser sends, and this way a price change applies immediately. */
    const { rows } = await db.execute("SELECT id, name, price, price_s, price_m, price_l, available FROM items");
    const byId = new Map(rows.map(r => [r.id, r]));
    const priced = [];
    for (const l of lines) {
      const key = String(l.key || "");
      const [itemId, sizeIdx] = key.split(":");
      const it = byId.get(itemId);
      if (!it) return bad(res, "Something on your order is no longer on the menu. Please refresh.");
      if (!it.available) return bad(res, `Sorry — ${it.name} just ran out. Remove it and try again.`);
      const qty = Math.max(1, Math.min(30, Math.round(Number(l.qty) || 0)));
      let price, label = it.name;
      if (sizeIdx !== undefined) {
        const sizes = [it.price_s, it.price_m, it.price_l];
        const names = ["Small", "Medium", "Large"];
        price = sizes[Number(sizeIdx)];
        if (price == null) return bad(res, "That size is not available.");
        label += ` (${names[Number(sizeIdx)]})`;
      } else {
        price = it.price;
        if (price == null) return bad(res, "That item has no price set.");
      }
      priced.push({ key, name: label, price: Number(price), qty });
    }
    const subtotal = priced.reduce((a, l) => a + l.price * l.qty, 0);
    const gst = Math.round(subtotal * (GST_PERCENT / 100));
    const total = subtotal + gst;
    const orderNo = "M" + String(Date.now()).slice(-5);
    const placedAt = nowIso();

    /* Paying online holds the order at 'pending_payment' so the kitchen never
       starts cooking something that was not paid for. Anything else behaves
       the way it always has: straight to the board, settle at the counter. */
    const wantsOnline = String(req.body?.payMode || "counter") === "online" && onlinePayEnabled();
    const status = wantsOnline ? "pending_payment" : "placed";
    const payStatus = wantsOnline ? "pending" : "unpaid";

    let rzp = null;
    if (wantsOnline) {
      try {
        rzp = await rzpCreateOrder({
          amountPaise: total * 100,
          receipt: orderNo,
          notes: { table, phone, order_no: orderNo },
        });
      } catch (e) {
        console.error("razorpay create order", e);
        return bad(res, "Online payment is unavailable right now. Please choose Pay at counter.", 502);
      }
    }

    const ins = await db.execute({
      sql: `INSERT INTO orders (order_no, table_label, phone, items_json, subtotal, gst, total, note,
                                status, placed_at, updated_at, payment_status, rzp_order_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [orderNo, table, phone, JSON.stringify(priced), subtotal, gst, total, note,
             status, placedAt, placedAt, payStatus, rzp?.id || null],
    });
    rememberOrder(req, res, Number(ins.lastInsertRowid));
    /* An abandoned checkout should not inflate anyone's spend, so online
       orders only join the customer record once payment clears. And with no
       phone there is nobody to credit — the repeat-customer list is keyed on
       the number. */
    if (!wantsOnline && phone) await bumpCustomer(phone, total, placedAt);

    res.json({ ok: true,
      order: { id: Number(ins.lastInsertRowid), no: orderNo, table, phone, items: priced,
               subtotal, gst, total, note, status, placedAt,
               paymentStatus: payStatus, paymentMode: null },
      ...(rzp ? { razorpay: { keyId: RZP_KEY(), orderId: rzp.id, amount: rzp.amount,
                              name: CAFE.code + " " + CAFE.name, prefillPhone: phone } } : {}) });
  } catch (e) {
    console.error("POST /api/orders", e);
    bad(res, "Could not send your order. Please call a server.", 500);
  }
});

/* ------------------------------------------------------------ waiter calls */
/* Deliberately open to anyone at a table — asking for a server should not
   require verifying a phone number first. The abuse control is per table
   instead: one open call at a time, plus a cooldown and an hourly cap. */
app.post("/api/calls", async (req, res) => {
  const table = String(req.body?.table || "").trim().slice(0, 24);
  if (!table) return bad(res, "Which table are you at?");
  if (!rateLimit("call:" + table, 10, 60 * 60_000))
    return bad(res, "That is a lot of calls. Please speak to a server directly.", 429);
  if (!rateLimit("callip:" + req.ip, 40, 60 * 60_000))
    return bad(res, "Too many requests from this connection.", 429);
  try {
    /* Already waiting? Hand back the existing call rather than stacking up. */
    const open = await db.execute({
      sql: "SELECT id, created_at FROM calls WHERE table_label = ? AND ack_at IS NULL ORDER BY id DESC LIMIT 1",
      args: [table] });
    if (open.rows[0]) return res.json({ ok: true, id: open.rows[0].id, alreadyWaiting: true });

    /* A minute's cooldown after one was answered, so a cleared call cannot be
       re-rung instantly. */
    const recent = await db.execute({
      sql: "SELECT ack_at FROM calls WHERE table_label = ? ORDER BY id DESC LIMIT 1", args: [table] });
    if (recent.rows[0]?.ack_at && Date.now() - new Date(recent.rows[0].ack_at).getTime() < 60_000)
      return bad(res, "A server was just with you. Give them a moment.", 429);

    const now = nowIso();
    const ins = await db.execute({
      sql: "INSERT INTO calls (table_label, created_at) VALUES (?, ?)", args: [table, now] });
    console.log(`bell: ${table}`);
    res.json({ ok: true, id: Number(ins.lastInsertRowid), alreadyWaiting: false });
  } catch (e) { console.error("POST /api/calls", e); bad(res, "Could not call a server.", 500); }
});

/* What the customer's own screen polls, to know somebody is coming. */
app.get("/api/calls/:id", async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: "SELECT ack_at FROM calls WHERE id = ?", args: [req.params.id] });
    if (!rows[0]) return bad(res, "No such call.", 404);
    res.json({ ok: true, acknowledged: !!rows[0].ack_at });
  } catch (e) { bad(res, "Could not check that.", 500); }
});

/* Staff: everything still waiting, oldest first — the longest wait is the
   one that matters most. */
app.get("/api/calls", requireStaff, async (_req, res) => {
  try {
    const { rows } = await db.execute(
      "SELECT id, table_label, created_at FROM calls WHERE ack_at IS NULL ORDER BY created_at ASC");
    res.json({ calls: rows.map(r => ({ id: r.id, table: r.table_label, at: r.created_at })) });
  } catch (e) { console.error("GET /api/calls", e); bad(res, "Could not load calls.", 500); }
});

app.patch("/api/calls/:id", requireStaff, async (req, res) => {
  try {
    await db.execute({ sql: "UPDATE calls SET ack_at = ? WHERE id = ? AND ack_at IS NULL",
                       args: [nowIso(), req.params.id] });
    res.json({ ok: true });
  } catch (e) { bad(res, "Could not clear that.", 500); }
});

/* --------------------------------------------------------------- payments */
/* The browser reporting "payment succeeded" proves nothing -- anyone can POST
   that. Only a signature computed with the key secret does. */
app.post("/api/payments/verify", async (req, res) => {
  const phone = verifiedPhone(req);
  if (!phone) return bad(res, "Verify your mobile number first.", 401);
  if (!onlinePayEnabled()) return bad(res, "Online payment is not configured.", 400);

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return bad(res, "Incomplete payment details.");

  const expected = hmacHex(`${razorpay_order_id}|${razorpay_payment_id}`, RZP_SECRET());
  if (!sameSignature(expected, razorpay_signature)) {
    console.warn("payment signature mismatch for", razorpay_order_id);
    return bad(res, "That payment could not be verified. Nothing has been charged twice — please show this screen to a member of staff.", 400);
  }

  try {
    const { rows } = await db.execute({
      sql: "SELECT * FROM orders WHERE rzp_order_id = ?", args: [razorpay_order_id] });
    const row = rows[0];
    if (!row) return bad(res, "Order not found.", 404);
    if (row.phone !== phone) return bad(res, "Not your order.", 403);

    if (await markPaid(razorpay_order_id, razorpay_payment_id))
      await bumpCustomer(row.phone, row.total, nowIso());

    const fresh = await db.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [row.id] });
    res.json({ ok: true, order: rowToOrder(fresh.rows[0]) });
  } catch (e) {
    console.error("POST /api/payments/verify", e);
    bad(res, "Payment taken, but we could not update your order. Please show this to a member of staff.", 500);
  }
});

/* Belt and braces. If the customer's phone loses signal between paying and
   telling us, this is what still gets the order onto the kitchen board. */
app.post("/api/payments/webhook", async (req, res) => {
  if (!RZP_HOOK()) return res.status(503).json({ error: "No webhook secret configured." });
  const given = req.headers["x-razorpay-signature"];
  const expected = hmacHex(req.rawBody || Buffer.alloc(0), RZP_HOOK());
  if (!sameSignature(expected, given)) {
    console.warn("webhook signature mismatch");
    return res.status(400).json({ error: "Bad signature." });
  }
  try {
    const event = req.body?.event;
    const entity = req.body?.payload?.payment?.entity;
    if (event === "payment.captured" && entity?.order_id) {
      if (await markPaid(entity.order_id, entity.id)) {
        const { rows } = await db.execute({
          sql: "SELECT phone, total FROM orders WHERE rzp_order_id = ?", args: [entity.order_id] });
        if (rows[0]) await bumpCustomer(rows[0].phone, rows[0].total, nowIso());
        console.log("webhook confirmed payment for", entity.order_id);
      }
    } else if (event === "payment.failed" && entity?.order_id) {
      await db.execute({
        sql: `UPDATE orders SET payment_status='failed', updated_at=?
               WHERE rzp_order_id=? AND payment_status='pending'`,
        args: [nowIso(), entity.order_id] });
    }
    res.json({ ok: true });          /* always 200 once verified, or Razorpay keeps retrying */
  } catch (e) {
    console.error("POST /api/payments/webhook", e);
    res.json({ ok: true });
  }
});

/* placed_at is stored as UTC ISO. Grouping "today" by UTC would put orders
   taken after 6:30pm IST on the following day's sheet, so day boundaries are
   shifted by an explicit offset instead of trusting the host's clock. */
const TZ_MIN = (() => {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(process.env.TZ_OFFSET || "+05:30");
  if (!m) return 330;
  const v = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === "-" ? -v : v;
})();
const LOCAL = `'${TZ_MIN >= 0 ? "+" : "-"}${Math.abs(TZ_MIN)} minutes'`;

/* Order history for the admin screen. Defined before /api/orders/:id because
   Express matches in order and would otherwise read "history" as an id. */
app.get("/api/orders/history", requireStaff, async (req, res) => {
  const range = ["today", "week", "month", "all"].includes(String(req.query.range))
    ? String(req.query.range) : "today";
  const q = String(req.query.q || "").trim().slice(0, 40);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 60));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  const where = [], args = [];
  if (range === "today") where.push(`date(placed_at, ${LOCAL}) = date('now', ${LOCAL})`);
  else if (range === "week") where.push("placed_at >= datetime('now','-7 days')");
  else if (range === "month") where.push("placed_at >= datetime('now','-30 days')");
  if (q) {
    where.push("(table_label LIKE ? OR phone LIKE ? OR order_no LIKE ?)");
    const like = "%" + q + "%";
    args.push(like, like, like);
  }
  const clause = where.length ? "WHERE " + where.join(" AND ") : "";

  try {
    const [list, agg, waiting] = await Promise.all([
      db.execute({ sql: `SELECT * FROM orders ${clause} ORDER BY placed_at DESC LIMIT ? OFFSET ?`,
                   args: [...args, limit, offset] }),
      /* Abandoned checkouts are listed but kept out of every money figure --
         nobody paid for them, so counting them would overstate the day. */
      /* Summed from the amounts, so an order settled half in cash and half on
         PhonePe lands in both columns instead of being credited wholly to one. */
      db.execute({ sql:
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS takings,
                COALESCE(SUM(paid_cash),0)   AS cash,
                COALESCE(SUM(paid_online),0) AS phonepe,
                COALESCE(SUM(CASE WHEN payment_mode='split' THEN 1 ELSE 0 END),0) AS split_count,
                COALESCE(SUM(CASE WHEN payment_mode IS NULL THEN total END),0) AS unpaid,
                SUM(CASE WHEN payment_mode IS NULL THEN 1 ELSE 0 END) AS unpaid_count
         FROM orders ${clause}${clause ? " AND" : " WHERE"} status != 'pending_payment'`, args }),
      db.execute({ sql:
        `SELECT COUNT(*) AS n FROM orders ${clause}${clause ? " AND" : " WHERE"}
         status = 'pending_payment'`, args }),
    ]);
    res.json({ range, q, limit, offset, orders: list.rows.map(rowToOrder),
               summary: { ...agg.rows[0], awaiting: Number(waiting.rows[0].n) } });
  } catch (e) {
    console.error("GET /api/orders/history", e);
    bad(res, "Could not load the order history.", 500);
  }
});

/* One order — what the customer's status screen polls. */
app.get("/api/orders/:id", async (req, res) => {
  try {
    const { rows } = await db.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [req.params.id] });
    if (!rows.length) return bad(res, "Order not found.", 404);
    const o = rowToOrder(rows[0]);
    if (!isStaff(req)) {
      const p = verifiedPhone(req);
      const mine = ownedOrderIds(req).includes(String(o.id));
      if (!mine && !(p && o.phone === p)) return bad(res, "Not your order.", 403);
    }
    res.json({ order: o });
  } catch (e) { console.error(e); bad(res, "Could not load that order.", 500); }
});

/* The kitchen board. */
app.get("/api/orders", requireStaff, async (_req, res) => {
  try {
    /* pending_payment is excluded on purpose: an order nobody has paid for
       must never reach the kitchen board. */
    const { rows } = await db.execute(
      `SELECT * FROM orders WHERE placed_at > datetime('now','-1 day')
         AND status != 'pending_payment' ORDER BY placed_at DESC LIMIT 120`);
    res.json({ orders: rows.map(rowToOrder) });
  } catch (e) { console.error(e); bad(res, "Could not load orders.", 500); }
});

/* Accepts a status change, a payment mode, or both. */
app.patch("/api/orders/:id", requireStaff, async (req, res) => {
  const sets = [], args = [];
  if (req.body?.status !== undefined) {
    const status = String(req.body.status);
    if (!["placed", "preparing", "served"].includes(status)) return bad(res, "Unknown status.");
    sets.push("status = ?"); args.push(status);
  }
  /* A whole-order tap: Cash or PhonePe puts the full total against that method. */
  if (req.body?.paymentMode !== undefined) {
    const pm = req.body.paymentMode;
    if (pm === null || pm === "") {
      sets.push("payment_mode = NULL", "paid_at = NULL", "paid_cash = 0", "paid_online = 0");
    } else {
      const mode = String(pm).toLowerCase();
      if (!PAY_MODES.includes(mode)) return bad(res, "Unknown payment mode.");
      sets.push("payment_mode = ?", "paid_at = ?"); args.push(mode, nowIso());
      sets.push(mode === "cash" ? "paid_cash = total, paid_online = 0"
                                : "paid_online = total, paid_cash = 0");
    }
  }
  /* A split: the amounts are what is recorded, and the label follows them. */
  if (req.body?.paidCash !== undefined || req.body?.paidOnline !== undefined) {
    const cash = Math.max(0, Math.round(Number(req.body.paidCash) || 0));
    const online = Math.max(0, Math.round(Number(req.body.paidOnline) || 0));
    if (!Number.isFinite(cash) || !Number.isFinite(online)) return bad(res, "Those amounts do not look right.");
    if (cash + online > 1_000_000) return bad(res, "That total is implausible.");
    const mode = cash && online ? "split" : cash ? "cash" : online ? "phonepe" : null;
    sets.push("paid_cash = ?", "paid_online = ?"); args.push(cash, online);
    if (mode){ sets.push("payment_mode = ?", "paid_at = ?"); args.push(mode, nowIso()); }
    else     { sets.push("payment_mode = NULL", "paid_at = NULL"); }
  }
  if (!sets.length) return bad(res, "Nothing to change.");
  sets.push("updated_at = ?"); args.push(nowIso());
  args.push(req.params.id);
  try {
    await db.execute({ sql: `UPDATE orders SET ${sets.join(", ")} WHERE id = ?`, args });
    res.json({ ok: true });
  } catch (e) { console.error(e); bad(res, "Could not update that order.", 500); }
});

app.delete("/api/orders/served", requireStaff, async (_req, res) => {
  try {
    const r = await db.execute("DELETE FROM orders WHERE status = 'served'");
    res.json({ ok: true, cleared: r.rowsAffected });
  } catch (e) { console.error(e); bad(res, "Could not clear those.", 500); }
});

/* Takings and repeat customers — handy at closing time. */
app.get("/api/stats", requireStaff, async (_req, res) => {
  try {
    const [today, top] = await Promise.all([
      db.execute(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS takings,
                COALESCE(SUM(CASE WHEN payment_mode='cash'    THEN total END),0) AS cash,
                COALESCE(SUM(CASE WHEN payment_mode='phonepe' THEN total END),0) AS phonepe,
                COALESCE(SUM(CASE WHEN payment_mode IS NULL   THEN total END),0) AS unpaid
         FROM orders WHERE date(placed_at, ${LOCAL}) = date('now', ${LOCAL})`),
      db.execute("SELECT phone, orders_count, total_spend, last_seen FROM customers ORDER BY orders_count DESC LIMIT 20"),
    ]);
    res.json({ today: today.rows[0], regulars: top.rows });
  } catch (e) { console.error(e); bad(res, "Could not load stats.", 500); }
});

/* ------------------------------------------------------------------ pages */
app.use(express.static(join(here, "public"), { extensions: ["html"] }));
app.get(["/kitchen", "/qr", "/admin"], (_req, res) => res.sendFile(join(here, "public", "index.html")));
/* The addresses this machine can be reached on. Used by the /qr screen to
   tell you when you are about to print codes pointing at localhost. */
app.get("/api/hosts", (_req, res) => {
  const nets = os.networkInterfaces();
  const ips = Object.values(nets).flat()
    .filter(n => n && n.family === "IPv4" && !n.internal)
    .map(n => n.address);
  res.json({ hosts: ips, port: PORT });
});

app.get("/healthz", (_req, res) => res.json({
  ok: true, sms: smsMode(),
  onlinePay: onlinePayEnabled() ? (RZP_HOOK() ? "razorpay+webhook" : "razorpay (NO WEBHOOK SET)") : "off",
}));
app.use((_req, res) => res.status(404).sendFile(join(here, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`\n0125 Mystic Falls Cafe`);
  console.log(`  menu     http://localhost:${PORT}/`);
  console.log(`  kitchen  http://localhost:${PORT}/kitchen`);
  console.log(`  qr codes http://localhost:${PORT}/qr`);
  console.log(`  SMS mode ${smsMode()}${smsMode() === "demo" ? "  (codes shown on screen, no texts sent)" : ""}`);
  if (!STAFF_PASSWORD) console.log(`  ! STAFF_PASSWORD is not set — /kitchen and /admin are locked out.`);
  console.log("");
});
