# 0125 My$tic Falls Café — QR ordering

Scan-to-order for the café in Anand Nagar, Nanded. Customers scan the code on
their table, order from their phone, verify by OTP; the kitchen sees it live.

Read `HANDOFF.md` first — it explains every decision, what is tested, and what
is left to do.

## Run it

```bash
npm install
cp .env.example .env    # fill in your Turso URL + token, and a staff password
npm run init-db         # creates the tables, loads the 101-item menu
npm start
```

| URL | Who |
|---|---|
| `/` | Customers (`/?t=5` for table 5) |
| `/kitchen` | Kitchen — staff password |
| `/admin` | Prices and sold-out flags — staff password |
| `/qr` | Printable QR codes |

## Notes

- The Turso token lives only in `.env`. It must never reach the browser.
- With no SMS provider configured, OTPs run in demo mode: the code is shown on
  screen instead of being texted. Fill in MSG91 or Fast2SMS in `.env` to send
  real messages — no code change needed.
- Prices are always calculated on the server from the database, never trusted
  from the browser.
