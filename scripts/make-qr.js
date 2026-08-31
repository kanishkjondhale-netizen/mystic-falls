/* Generates printable table QR codes.
 *
 *   npm run qr -- https://your-cafe-domain.com          (9 tables, the default)
 *   npm run qr -- https://your-cafe-domain.com 14       (14 tables)
 *   npm run qr -- https://your-cafe-domain.com 9 takeaway
 *
 * Writes one PNG per table into qr-codes/, plus print-me.html — an A4 sheet of
 * table cards you can send straight to a printer.
 *
 * The URL matters more than anything else here: a code is a printed object,
 * and reprinting is the expensive part. Generate these AFTER the site is
 * deployed, using the address customers will actually reach.
 */
import QRCode from "qrcode";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CAFE } from "../menu-data.js";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "qr-codes");

const base = (process.argv[2] || "").replace(/\/+$/, "");
const tables = Math.max(1, Math.min(60, parseInt(process.argv[3], 10) || 9));
const withTakeaway = process.argv.includes("takeaway");

if (!base || !/^https?:\/\//i.test(base)) {
  /* Work out what this machine is reachable as right now, so the suggestions
     are real rather than a stale example someone copies by mistake. */
  const os = await import("node:os");
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter(n => n && n.family === "IPv4" && !n.internal).map(n => n.address);
  const host = os.hostname();
  console.error(`
Give the address customers will actually open, including http:// or https://

  For real, printed codes — after deploying:
    npm run qr -- https://your-cafe-domain.com
    npm run qr -- https://your-cafe-domain.com 14 takeaway

  For a trial run on this wifi, right now:
${ips.map(ip => `    npm run qr -- http://${ip}:3000`).join("\n") || "    (no network address found)"}
    npm run qr -- http://${host}.local:3000     <- survives your IP changing,
                                                   if the phone supports it
`);
  process.exit(1);
}
if (/localhost|127\.0\.0\.1/i.test(base)) {
  console.error("\nlocalhost only works on this one computer — a printed code pointing there is useless to a customer.\n");
  process.exit(1);
}
/* The example domains from the docs. Generating against these silently
   produces codes that scan to nothing, which is worse than failing. */
if (/your-cafe-domain|yourdomain|example\.(com|org|net)|your-domain|mydomain/i.test(base)) {
  console.error(`
"${base}" is the placeholder from the instructions, not a real address.
Codes built from it will scan to a dead site.

Use your deployed address, or one of these for a trial run on this wifi:
`);
  const os = await import("node:os");
  Object.values(os.networkInterfaces()).flat()
    .filter(n => n && n.family === "IPv4" && !n.internal)
    .forEach(n => console.error(`    npm run qr -- http://${n.address}:3000`));
  console.error("");
  process.exit(1);
}
const local = /^http:\/\/(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(base);

await mkdir(OUT, { recursive: true });
/* Clear previous codes first. A folder holding a mix of codes from two
   different URLs is how the wrong ones end up laminated on the tables. */
const { readdir, unlink } = await import("node:fs/promises");
const stale = (await readdir(OUT)).filter(f => /^table-.*\.png$/.test(f));
for (const f of stale) await unlink(join(OUT, f));
if (stale.length) console.log(`  cleared ${stale.length} code(s) from a previous run\n`);

const targets = [];
for (let i = 1; i <= tables; i++) targets.push({ label: String(i), name: "Table " + i, url: `${base}/?t=${i}` });
if (withTakeaway) targets.push({ label: "TA", name: "Takeaway", url: `${base}/?t=takeaway` });

const cards = [];
for (const t of targets) {
  const file = `table-${t.label}.png`;
  await QRCode.toFile(join(OUT, file), t.url, {
    width: 900,                       /* generous: printers are unforgiving */
    margin: 2,
    errorCorrectionLevel: "H",        /* survives a scuff or a coffee ring */
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  cards.push({ ...t, file });
  console.log(`  ${file.padEnd(16)} -> ${t.url}`);
}

/* A print sheet, black on white. The café's gold-on-black looks great on a
   screen and wastes a cartridge on paper. */
const html = `<!doctype html><meta charset="utf-8">
<title>${CAFE.code} ${CAFE.name} — table codes</title>
<style>
  @page{size:A4;margin:12mm}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;background:#fff}
  .note{padding:10px 0 16px;font-size:12px;color:#666;border-bottom:1px solid #ddd;margin-bottom:14px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10mm}
  .card{border:1px dashed #999;border-radius:6px;padding:8mm 4mm 6mm;text-align:center;break-inside:avoid}
  .cafe{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#555;margin-bottom:2mm}
  .card img{width:100%;max-width:46mm;height:auto;display:block;margin:0 auto}
  .num{font-size:20px;font-weight:700;margin-top:3mm;letter-spacing:.04em}
  .cta{font-size:11px;color:#555;margin-top:1mm}
  @media print{.note{display:none}}
</style>
<div class="note">
  Codes point at <b>${base}</b>${local ? " — a private network address, so these work only on the café's own wifi. Fine for testing, not for printing." : ""}.
  Cut along the dashed lines. Laminate or use standing holders.
</div>
<div class="grid">
${cards.map(c => `  <div class="card">
    <div class="cafe">${CAFE.code} ${CAFE.name}</div>
    <img src="${c.file}" alt="${c.name}">
    <div class="num">${c.name.toUpperCase()}</div>
    <div class="cta">Scan to see the menu &amp; order</div>
  </div>`).join("\n")}
</div>`;
await writeFile(join(OUT, "print-me.html"), html, "utf8");

console.log(`\n  ${cards.length} codes written to qr-codes/`);
console.log(`  open qr-codes/print-me.html and print it\n`);
if (local) {
  console.log("  NOTE: that is a private network address. These scan only on the café's");
  console.log("  own wifi — good for a trial run, not for the tables. Re-run this with");
  console.log("  your public address once the site is deployed.\n");
}
