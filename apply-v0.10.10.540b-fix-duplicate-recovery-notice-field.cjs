const fs = require("fs");
const path = require("path");

const FILE = path.join("src", "network", "MultiplayerClient.ts");

if (!fs.existsSync(FILE)) {
  throw new Error(
    `Missing ${FILE}. Run this from C:\\Users\\bak12\\color-hunt. No file written.`
  );
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");
const original = s;

const declaration =
  "  private connectionRecoveryNoticeArmed = false;";

const positions = [];
let from = 0;
while (true) {
  const i = s.indexOf(declaration, from);
  if (i < 0) break;
  positions.push(i);
  from = i + declaration.length;
}

if (positions.length === 1) {
  console.log("[skip] connectionRecoveryNoticeArmed already has exactly one declaration.");
  console.log("No file change needed. Next: npm run build");
  process.exit(0);
}

if (positions.length !== 2) {
  throw new Error(
    `Expected exactly 2 connectionRecoveryNoticeArmed declarations after v540, found ${positions.length}. No file written.`
  );
}

/*
 * v540 inserted its duplicate together with these new grace fields.
 * Keep the v540 grace fields, but remove ONLY the duplicate declaration
 * nearest them. The pre-existing recovery notice field remains untouched.
 */
const graceAnchor =
  "  private connectionIssueGraceUntil = 0;";

const graceAt = s.indexOf(graceAnchor);

if (graceAt < 0) {
  throw new Error(
    "v540 grace field connectionIssueGraceUntil not found. No file written."
  );
}

let duplicateAt = -1;

for (const pos of positions) {
  if (pos > graceAt && pos - graceAt < 300) {
    duplicateAt = pos;
    break;
  }
}

if (duplicateAt < 0) {
  throw new Error(
    "Could not safely identify the v540-added duplicate field. No file written."
  );
}

s =
  s.slice(0, duplicateAt) +
  s.slice(duplicateAt + declaration.length);

/* Remove only the extra blank line left by deleting that field. */
s = s.replace(
  `${graceAnchor}\n\n\n`,
  `${graceAnchor}\n\n`
);

const remaining =
  (s.match(/private connectionRecoveryNoticeArmed\s*=\s*false\s*;/g) || [])
    .length;

if (remaining !== 1) {
  throw new Error(
    `Postcondition failed: expected 1 connectionRecoveryNoticeArmed declaration, found ${remaining}. No file written.`
  );
}

if (!s.includes("connectionIssueGraceTimer") ||
    !s.includes("connectionIssueGraceGeneration") ||
    !s.includes("connectionIssueGraceUntil")) {
  throw new Error(
    "Postcondition failed: v540 grace fields were damaged. No file written."
  );
}

fs.mkdirSync(".patch-backups", { recursive: true });
fs.writeFileSync(
  path.join(
    ".patch-backups",
    "MultiplayerClient-before-v540b-duplicate-field-fix.ts"
  ),
  original,
  "utf8"
);

fs.writeFileSync(FILE, s, "utf8");

console.log("Applied v0.10.10.540b.");
console.log(" - removed ONLY the duplicate connectionRecoveryNoticeArmed field");
console.log(" - kept the original field");
console.log(" - kept all v540 550ms reconnect-grace logic");
console.log(" - backup created in .patch-backups");
console.log("Next: npm run build");
