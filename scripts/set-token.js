/* Writes your Turso auth token into .env without you opening a file, and
   without the token ever appearing on screen, in your shell history, or in
   this script's output.

     npm run set-token

   Paste when prompted and press Enter. Everything else in .env is left
   exactly as it was. */
import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import readline from "node:readline";
import { execFileSync } from "node:child_process";

const ENV = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");

if (!existsSync(ENV)) {
  console.error("\nNo .env file found. Copy .env.example to .env first.\n");
  process.exit(1);
}

function askHidden(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let seen = 0;
    rl.stdoutMuted = false;
    /* The token itself is never echoed, but a running character count is --
       a prompt that shows absolutely nothing on paste looks broken. */
    rl._writeToOutput = s => {
      if (!rl.stdoutMuted) return rl.output.write(s);
      seen += s.length;
      rl.output.write(`\r${question}[${seen} characters pasted]`);
    };
    rl.question(question, answer => { rl.close(); process.stdout.write("\n"); resolve(answer.trim()); });
    rl.stdoutMuted = true;              // set after question(), so the prompt itself still prints
  });
}

/* Route 2: read straight from the clipboard, so there is no prompt to fight
   with at all. Copy the token, run `npm run set-token -- --clipboard`. */
function fromClipboard() {
  if (process.platform === "win32")
    return execFileSync("powershell.exe",
      ["-NoProfile", "-Command", "Get-Clipboard -Raw"], { encoding: "utf8" });
  if (process.platform === "darwin")
    return execFileSync("pbpaste", { encoding: "utf8" });
  return execFileSync("xclip", ["-selection", "clipboard", "-o"], { encoding: "utf8" });
}

let token;
if (process.argv.includes("--clipboard")) {
  try {
    token = fromClipboard().trim();
    console.log(`\nRead ${token.length} characters from the clipboard.`);
  } catch (e) {
    console.error(`\nCould not read the clipboard: ${e.message}`);
    console.error("Run `npm run set-token` without --clipboard and paste at the prompt.\n");
    process.exit(1);
  }
} else {
  console.log("\nPaste the Turso auth token, then press Enter.");
  console.log("The token stays hidden; you will see a character count as it lands.\n");
  token = await askHidden("Token: ");
}

if (!token) {
  console.error("Nothing pasted. .env left unchanged.\n");
  process.exit(1);
}
/* Turso tokens are JWTs: three base64url segments separated by dots. This
   catches a half-copied paste before it turns into a confusing 401. */
if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
  console.error(`That does not look like a complete token (got ${token.length} characters,` +
                ` ${token.split(".").length} dot-separated parts, expected 3).`);
  console.error("Copy the whole string from the Turso dashboard. .env left unchanged.\n");
  process.exit(1);
}

const src = readFileSync(ENV, "utf8");
const line = `TURSO_AUTH_TOKEN=${token}`;
const out = /^TURSO_AUTH_TOKEN=.*$/m.test(src)
  ? src.replace(/^TURSO_AUTH_TOKEN=.*$/m, line)
  : src.trimEnd() + "\n" + line + "\n";

writeFileSync(ENV, out, "utf8");
try { chmodSync(ENV, 0o600); } catch {}   /* best effort; a no-op on most Windows setups */

console.log(`Saved to .env (${token.length} characters).`);
console.log("Now run:  npm run check-db\n");
