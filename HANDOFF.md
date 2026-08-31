# 0125 My$tic Falls Café — QR ordering system
## Complete handoff brief

Paste this whole file into Claude Code as your first message. It contains
everything built so far, why each decision was made, what is proven to work,
and exactly what is left to do.

---

## 1. What this is

A scan-to-order system for **0125 MY$TIC FALLS CAFÉ**, Anand Nagar, Nanded.
A customer scans a QR code on their table, the menu opens with the table number
already filled in, they build an order, verify their mobile number with an OTP,
and the order appears live on a kitchen screen.

**Café facts** (from their printed menu PDF, all transcribed already):

| Field | Value |
|---|---|
| Name | `0125 MY$TIC FALLS CAFÉ` (the `$` is deliberate, part of the logo) |
| Location | Anand Nagar, Nanded |
| Tagline | "Siblings Friends Family" |
| Instagram | `@0125_MYSTIC_FALLS` |
| Wi-Fi password | `Nyc@0125` |
| Payment | Cash and PhonePe at the counter |
| Menu | **100% vegetarian** — no meat, no egg anywhere on the card |
| Prices | Flat, no GST line printed. GST is configurable but defaults to **0** |

---

## 2. Current state — two separate things exist

### (a) A published Claude Artifact — a working demo
Uses Claude's built-in artifact database. **Its limitation is why we moved on:**
an artifact declaring the `db` capability is organisation-internal, so a walk-in
customer scanning a QR code cannot open it without signing in. Fine as a preview,
useless for real customers. Do not keep building on this.

### (b) A deployable Node app — the real thing
Built at `mystic-falls/`. This is what you continue. It connects to Turso, holds
the auth token server-side, and once deployed gives a public URL that any
customer can scan. **This is the codebase in the attached zip.**

---

## 3. Two hard constraints discovered (do not re-litigate these)

1. **A browser page must never hold the Turso auth token.** Anyone who opens
   devtools gets full read-write access to the database. The token lives only in
   a server-side environment variable. This is why a server exists at all.

2. **A published Claude Artifact cannot reach Turso.** The artifact sandbox
   blocks all outbound `fetch`/XHR/WebSocket to any host. Not a setting that can
   be changed. So "connect the artifact to the database" is impossible by
   construction — the deployable server is the only path.

Also: `turso.io` is blocked from the sandbox the code was written in, so **the
live connection to Turso has never actually been tested.** Everything was tested
against a local SQLite file through the identical libsql client. Verifying the
real Turso connection is task #1 below.

---

## 4. Architecture

```
Customer phone ──▶ Node/Express server ──▶ Turso (libsql)
Kitchen tablet ──▶      (holds token)
```

- Server: Express, ESM, `@libsql/client`.
- Frontend: one self-contained `public/index.html`, no framework, no build step.
- Live updates: polling (kitchen 4s, customer status 5s). Deliberately not
  WebSockets — polling survives every host and proxy without configuration.
- Auth: two independent cookie sessions.
  - Customer: HMAC-signed `mf_ptok` cookie, set only after OTP verification.
  - Staff: HMAC-signed `mf_staff` cookie from a shared password.

### Routes
| Path | Who | What |
|---|---|---|
| `/?t=5` | customer | Menu, table 5 pre-filled |
| `/kitchen` | staff | Live ticket board, password gated |
| `/admin` | staff | Price + sold-out editor, password gated |
| `/qr` | anyone | Printable QR codes, café code + per-table codes |

### API
| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/api/menu` | — | Menu from DB; falls back to the copy baked into the HTML |
| PATCH | `/api/menu/item/:id` | staff | `{price}` / `{prices:[s,m,l]}` / `{available}` |
| POST | `/api/otp/send` | — | Rate limited 5 per phone / 15 min |
| POST | `/api/otp/verify` | — | Max 5 wrong tries, 5 min expiry, sets customer cookie |
| GET | `/api/me` | — | Returns the verified phone, if any |
| POST | `/api/orders` | customer | **Prices server-side from the DB** |
| GET | `/api/orders/:id` | owner or staff | Customer status polling |
| GET | `/api/orders` | staff | Kitchen board, last 24h, max 120 |
| PATCH | `/api/orders/:id` | staff | `placed` → `preparing` → `served` |
| DELETE | `/api/orders/served` | staff | Clear the served column |
| GET | `/api/stats` | staff | Today's takings + top 20 repeat customers |
| POST | `/api/staff/login` \| `/logout`, GET `/me` | — | Timing-safe password compare |

**Security decisions already made — keep them:**
- The browser sends only `{key, qty}`. Every price is looked up in the DB
  server-side. A tampered client cannot change a price. *(Tested: client claiming
  `price:1, qty:999` came back priced from the DB and clamped to qty 30.)*
- Quantity clamped 1–30, max 60 line items, note capped at 400 chars.
- Sold-out items are rejected at order time with a readable message.
- A customer can only read their own order (403 otherwise). *(Tested.)*

---

## 5. Database schema (`schema.sql`, already written)

`orders`, `otps`, `customers`, `sections`, `items`.

- `orders.items_json` stores the priced line items as JSON — a snapshot, so a
  later price change never rewrites history.
- `customers` is built automatically on every order: `orders_count`,
  `total_spend`, `first_seen`, `last_seen`. This is the repeat-customer list.
- `sections` + `items` hold the menu so prices change without a redeploy.
  `items.price` for plain dishes; `price_s/price_m/price_l` for pizzas.
  `items.available = 0` means sold out.

`npm run init-db` creates the tables and upserts all 101 menu items. Safe to
re-run: it refreshes names and prices without touching orders or sold-out flags.

---

## 6. OTP — read this carefully

**A web page cannot send SMS.** It needs a gateway account. So:

- `sms.js` has three modes, chosen by which env vars are filled:
  - **demo** (default, nothing configured): the server generates the code, stores
    it in Turso, and returns it to the browser, which shows it in a box clearly
    labelled "Demo mode — no SMS provider is configured".
  - **msg91**: set `MSG91_AUTH_KEY` + `MSG91_TEMPLATE_ID`.
  - **fast2sms**: set `FAST2SMS_API_KEY`.
- Switching to real SMS is **only** filling in `.env`. No code change.
- The code is **never** checked in the browser. `/api/otp/verify` does it and
  sets the signed cookie. The demo code being visible does not let anyone forge
  an order for someone else's number — but obviously ship a real provider before
  you rely on it for anything.

Everything around it is production-real: 5-minute expiry, 5 wrong-try lockout,
30-second resend cooldown, per-phone and per-IP rate limits, number remembered
for 180 days so regulars skip the step entirely.

---

## 7. Design system — please preserve it

The café's printed menu is black and gold. The app deliberately commits to that
single dark world rather than following the viewer's light/dark preference.

```css
--ground:#1A1918;  --surface:#232120;  --surface-2:#2C2A28;  --sunk:#151413;
--line:#38352F;    --line-strong:#4A463F;
--ink:#F4F1EB;     --ink-2:#ABA398;    --ink-3:#7A7369;
--gold:#E3B24A;    --gold-hi:#F5D682;  --gold-lo:#B98A22;
--amber:#F79F3D;   --amber-hi:#FBC26E; --lime:#C6DC4B;     --veg:#5BBF5F;
```

- **Display / headings:** Chakra Petch 700, uppercase, letter-spaced. Squared
  terminals echo the printed logo.
- **Body / UI:** Saira. **Kitchen tickets:** Share Tech Mono — reads like a
  thermal receipt, which is the point.
- Section headings are orange **brush-stroke badges** (skewed pill + end flicks),
  copied from the printed card.
- The café name renders as gradient gold text (`.goldtext`).
- Prices are gold, `font-variant-numeric: tabular-nums` everywhere digits align.
- **Pure Veg** badge sits in the header — true of the whole menu, so it replaced
  a useless veg filter.

### Dish imagery
- 12 photos were **extracted from the café's own menu PDF**, cropped, and inlined
  as base64 JPEG data URIs (~300KB total): shakes, mocktail, pizza, burger,
  fries, sandwich, baked sandwich, pasta, twister, manchurian, noodles, dessert.
  They appear as a hero strip at the top of each section.
- Six sections have no usable photo (coffee, maggie, momo, rice, soup, paneer) —
  these get a **glyph panel**: a diagonal-hatch panel with a large line icon.
  Chosen over stretching a low-resolution thumbnail.
- All 101 rows carry a small SVG line glyph for their dish family (18 hand-drawn
  24×24 stroke icons in the `G` object).
- **If the owner supplies real per-dish photos, that is the upgrade**: swap the
  section hero for a per-row thumbnail.

---

## 8. Verified working (tested end to end against a live server)

- 101 items across 18 sections load from the database.
- Pizza sizes: three tappable price chips; cart and kitchen ticket both read
  "Margherita (Medium)".
- Cart maths correct (checked by hand: 2×₹150 + ₹250 = ₹370).
- OTP: bad number rejected, wrong code rejected, correct code verifies and
  places the order in one step.
- Kitchen is password gated; wrong password refused; tickets show table, order
  number, **customer phone number**, items, note, and age (turns red past 12 min).
- Staff advances a ticket → **the customer's screen updates by itself** within
  the poll interval. Confirmed: "The kitchen has your order." → "Cooking now."
- Admin editor: typing a new price saves to the database and the customer menu
  picks it up. Sold-out toggle hides the dish and rejects it at order time.
- QR codes decode to the right URL (verified by actually decoding the rendered
  image with OpenCV — table 3's code resolves to `/?t=3`).
- Repeat customer: verified number is remembered, second order skips OTP.
- Stats endpoint returns today's takings and the regulars list.

---

## 9. What is left to do

1. **Test the real Turso connection.** Never tested — the sandbox blocked
   `turso.io`. Put the real URL and token in `.env`, run `npm run init-db`, and
   confirm 18 sections / 101 items load. This is the first thing to do.
2. **Deploy it.** Any Node host — Railway, Render, Fly, a VPS. Set the env vars
   there. Vercel needs the Express app wrapped as a serverless function, and the
   in-memory rate limiter should move into the database if you go serverless
   (it is per-process).
3. **Point the QR codes at the deployed domain**, print, and stand them on the
   tables. `/qr` generates them from `location.origin`, so they self-correct once
   deployed. There is a "Save as PNG" button for the café-wide code.
4. **Sign up for MSG91 or Fast2SMS** and fill in `.env` to make OTPs real.
5. **Rotate the Turso token.** It was pasted into a chat window. Rotate it in the
   Turso dashboard and put the new one only in `.env` / your host's env settings.
   Confirm `.env` is gitignored (it is, already).

### Nice-to-haves, not built
- A per-dish photo upload in `/admin`.
- Order history / daily sales report page (the `/api/stats` data exists, no UI).
- Printing a ticket to a thermal printer from the kitchen screen.
- Marking a dish sold out from the kitchen screen instead of `/admin`.

---

## 10. Setup commands

```bash
npm install
cp .env.example .env      # fill in TURSO_*, STAFF_PASSWORD, SESSION_SECRET
npm run init-db           # creates tables, loads the 101-item menu
npm start                 # http://localhost:3000
```

**Files:** `server.js` (API + static), `db.js` (client + SQL runner),
`sms.js` (OTP provider), `menu-data.js` (the transcribed menu, seed source),
`schema.sql`, `scripts/init-db.js`, `public/index.html` (all four screens),
`public/vendor/qrcode.min.js` (vendored locally, not a CDN, so it works on café
wifi that blocks CDNs).

---

## 11. The full menu as transcribed — check it against the printed card

Prices in rupees. Pizza shows small / medium / large (8" / 10" / 12").
Two known corrections were made to the printed card: "VEGTABLE SOUP" → "Vegetable
Soup". Left as the café spells them: "Schejwan", "Maggie", "Tripple Rice".

### Coffee
- `cf1` Regular Coffee — ₹50
- `cf2` Thick Coffee — ₹70
- `cf3` Chocolate Coffee — ₹80
- `cf4` Crush Cold Coffee — ₹90
- `cf5` Cold Coffee with Ice-Cream — ₹100

### Shakes
- `sh1` Chocolate Shake — ₹100
- `sh2` Oreo Shake — ₹120
- `sh3` KitKat Shake — ₹120
- `sh4` Pineapple Milk Shake — ₹120
- `sh5` Mango Milk Shake — ₹140
- `sh6` Brownie Shake — ₹150
- `sh7` Sitafal Shake — ₹150
- `sh8` Strawberry Milk Shake — ₹150
- `sh9` Anjeer Milk Shake — ₹150

### Mocktails
- `mj1` Green Apple Mojito — ₹100
- `mj2` Blue Curacao Mojito — ₹100
- `mj3` Mango Mojito — ₹100
- `mj4` Strawberry Mojito — ₹100

### Pizza  _(Small 8 inch · Medium 10 inch · Large 12 inch)_
- `pz1` Margherita — ₹130 / 150 / 180
- `pz2` Onion Pizza — ₹140 / 170 / 200
- `pz3` Capsicum Pizza — ₹140 / 170 / 200
- `pz4` Tomato Pizza — ₹140 / 170 / 200
- `pz5` Veg Pizza — ₹150 / 180 / 210
- `pz6` Tandoor Veg Pizza — ₹170 / 200 / 230
- `pz7` Spicy Veg Pizza — ₹180 / 200 / 230
- `pz8` Peri Peri Pizza — ₹180 / 210 / 240
- `pz9` Mushroom Pizza — ₹190 / 220 / 250
- `pz10` Veg Overload Pizza — ₹200 / 230 / 250
- `pz11` Corn Pizza — ₹200 / 230 / 250
- `pz12` Tandoor Paneer Pizza — ₹200 / 230 / 250
- `pz13` Cheese Corn Pizza — ₹200 / 250 / 300
- `pz14` Cheese Burst Pizza — ₹200 / 250 / 300
- `pz15` 0125 My$tic Pizza (Combo) [tag: House special] — ₹400 / 450 / 500

### Burger
- `bg1` Veg Burger — ₹70
- `bg2` Veg Cheese Burger — ₹80
- `bg3` Paneer Burger — ₹100
- `bg4` Peri Peri Burger — ₹120
- `bg5` Spicy Paneer Burger — ₹130
- `bg6` 0125 My$tic Burger (Combo) [tag: House special] — ₹150

### Fries
- `fr1` Salted — ₹80
- `fr2` Masala — ₹100
- `fr3` Peri Peri — ₹120
- `fr4` Schejwan — ₹140
- `fr5` Cheese — ₹150

### Sandwiches
- `sw1` Veg Grill — ₹70
- `sw2` Veg Cheese — ₹80
- `sw3` Corn Sandwich — ₹90
- `sw4` Paneer Cheese — ₹100
- `sw5` Chocolate — ₹100
- `sw6` Rich Creamy — ₹120
- `sw7` Garlic Cheese — ₹120

### Baked Sandwiches
- `bs1` Indian Cottage Cheese — ₹150
- `bs2` Potato-Cheese — ₹170
- `bs3` Chatpata Paneer — ₹180
- `bs4` Tandoor Special — ₹190
- `bs5` New York Special — ₹200

### Pasta
- `ps1` White Sauce Pasta — ₹130
- `ps2` Red Sauce Pasta — ₹140
- `ps3` Cheese Pasta — ₹150

### Twister
- `tw1` Regular — ₹60
- `tw2` Masala — ₹70
- `tw3` Magic Masala — ₹80
- `tw4` Tandoor — ₹90
- `tw5` Peri Peri — ₹100
- `tw6` Cheese — ₹120

### Maggie
- `mg1` Regular Maggie — ₹50
- `mg2` Veg Maggie — ₹60
- `mg3` Tandoor Maggie — ₹70
- `mg4` Corn Maggie — ₹80
- `mg5` Paneer Maggie — ₹90
- `mg6` Paneer Cheese — ₹100

### Momo
- `mo1` Veg Momo — ₹100
- `mo2` Paneer Momo — ₹120

### Manchurian
- `mn1` Veg Manchurian (10 pc) — ₹80
- `mn2` Dry Manchurian (10 pc) — ₹80

### Paneer
- `pn1` Paneer Manchurian (10 pc) — ₹100
- `pn2` Paneer 65 (10 pc) — ₹120
- `pn3` Paneer Chilli (10 pc) — ₹130
- `pn4` Paneer Dragon (10 pc) — ₹150

### Rice
- `rc1` Fried Rice — ₹70
- `rc2` Schejwan Rice — ₹80
- `rc3` Manchurian Rice — ₹90
- `rc4` Manchurian Schejwan — ₹100
- `rc5` Paneer Schejwan — ₹110
- `rc6` Tripple Rice — ₹120
- `rc7` Mushroom Rice — ₹140

### Noodles
- `nd1` Hakka Noodles — ₹70
- `nd2` Veg Noodles — ₹80
- `nd3` Schejwan Noodles — ₹90
- `nd4` Manchurian Noodles — ₹100
- `nd5` Paneer Noodles — ₹120
- `nd6` Paneer Schejwan Noodles — ₹140

### Soup
- `sp1` Manchow Soup — ₹70
- `sp2` Vegetable Soup — ₹80
- `sp3` Sweetcorn Soup — ₹90
- `sp4` Mushroom Soup — ₹100

### Dessert
- `ds1` Vanilla — ₹70
- `ds2` Chocolate — ₹80
- `ds3` Butterscotch — ₹90
- `ds4` Dry-Fruit Apricot — ₹150
- `ds5` 0125 My$tic Special [tag: House special] — ₹200


---

*Transcribed from the café's 10-page printed menu PDF. 101 items, 131 price
points, all verified against the source pages.*
