# 0125 My$tic Falls Café — scan-to-order

Scan-to-order for the café in Anand Nagar, Nanded. A customer scans the code on
their table, orders from their phone and verifies a mobile number by OTP; the
kitchen sees it live and the counter records how it was paid.

One Node/Express app serves all four screens.

---

## Get a live link

The app needs a server, so its address comes from deploying it. One click:

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template?template=https://github.com/kanishkjondhale-netizen/mystic-falls)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/kanishkjondhale-netizen/mystic-falls)

Either one asks for the Turso URL, the Turso token and a staff password, then
hands back an `https://…` address that works from anywhere — mobile data
included — and never changes.

**Pick a plan that does not sleep when idle.** The first customer to scan after
a quiet hour would otherwise wait through a cold start, and that is exactly the
moment it costs you an order.

## The four screens

Once deployed, everything hangs off that one address:

| Screen | Path | Who |
|---|---|---|
| **Customer menu** | `/?t=5` | Anyone — `?t=5` pre-fills table 5 |
| **Admin** | `/admin` | Staff password |
| **Kitchen board** | `/kitchen` | Staff password |
| **Table QR codes** | `/qr` | Staff — print from here |
| Health check | `/healthz` | Point an uptime monitor here |

Tables are `/?t=1` … `/?t=9`, plus `/?t=takeaway`. The number rides in the query
string, so the kitchen always knows where an order goes.

Then print the codes against the real address:

```bash
npm run qr -- https://your-live-address
```

---

## What each screen does

**Customer menu** — 101 dishes across 18 sections, each with a one-line
description of how it tastes and how it arrives. Search matches names *and*
descriptions, so "creamy" or "smoky" finds dishes whose names never say it.
Pizzas have per-size steppers. A bell in the header calls a server.

**Admin** — every order with table, items, phone, time and total. Records
payment as Cash, PhonePe, or a **split** across both, so a bill settled half
each lands in both columns instead of being credited to one. Filter by
Today / 7 days / 30 days / All, or search by table, phone or order number.
Second tab edits prices and sold-out flags, live.

**Kitchen** — three columns, New → Preparing → Served. Chimes when an order
arrives, and a different, more insistent sound when a table presses the bell.
Tickets turn red past 12 minutes.

**QR codes** — printable table cards, built from whatever address you open the
page at.

---

## Before the first deploy

The database has to exist. Run this once from your own machine — it creates the
tables in Turso and loads the menu, and the same database then serves the
deployed app.

```bash
npm install
cp .env.example .env
npm run set-token          # paste the Turso token; it never hits your shell history
npm run setup              # create the tables and load the 101-item menu
```

`npm run setup` should report **18 sections, 101 items**. If it does not, the
deploy will fail the same way, so fix it here first.

## Running it on your own machine

Only needed for development — customers never reach this.

```bash
npm start
```

### Scripts

| Command | What it does |
|---|---|
| `npm start` | Run the server |
| `npm run dev` | Same, restarting on file changes |
| `npm run setup` | `init-db` then `check-db` |
| `npm run init-db` | Create tables, load the menu. Safe to re-run |
| `npm run check-db` | Tell a bad token from a bad URL from an empty database |
| `npm run set-token` | Write the Turso token into `.env`, hidden as you type |
| `npm run qr -- <url>` | Generate printable table codes for that address |

---

## Deploying by hand

The buttons above cover it, but any Node host works: no build step, four
runtime dependencies, nothing written to disk — an ephemeral filesystem is
fine.

Set these in the host's environment. **Never upload `.env` itself.**

| Variable | Notes |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://…` |
| `TURSO_AUTH_TOKEN` | From the Turso dashboard |
| `STAFF_PASSWORD` | Opens `/admin` and `/kitchen` |
| `SESSION_SECRET` | Any long random string; changing it signs everyone out |
| `TZ_OFFSET` | `+05:30`, so "today's takings" means an Indian day |
| `GST_PERCENT` | `0` unless you charge it |
| `MSG91_*` / `FAST2SMS_API_KEY` | Optional — real OTP texts |
| `RAZORPAY_*` | Optional — prepaid online payment |

Run **one instance**. The rate limiter that stops OTP abuse lives in memory; if
you scale to several it has to move into the database first.

After deploying, regenerate the codes against the real domain:

```bash
npm run qr -- https://YOUR-DOMAIN
```

---

## How it behaves

- **Prices are calculated server-side from the database.** The browser sends
  only `{key, qty}`; a tampered client cannot change a price. Quantities are
  clamped, sold-out dishes are refused at order time.
- **The Turso token never reaches the browser.** That is why a server exists at
  all — a page holding the token would hand anyone with devtools full
  read-write access to the database.
- **OTP is verified on the server**, never in the page. With no SMS provider
  configured it runs in demo mode and shows the code on screen — fine for
  testing, not for customers.
- **Online payment is verified by signature**, and a webhook confirms it even
  if the customer's phone drops out mid-payment. Unpaid orders never reach the
  kitchen board.

`HANDOFF.md` explains every decision and what is left to do.
`IMAGE-CREDITS.md` records the licence behind every photo.
