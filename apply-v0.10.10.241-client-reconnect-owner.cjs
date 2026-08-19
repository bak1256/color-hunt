const fs = require("fs");
const path = require("path");

const file = path.resolve(process.cwd(), "src/network/MultiplayerClient.ts");
if (!fs.existsSync(file)) {
  throw new Error(`Missing ${file}`);
}

let s = fs.readFileSync(file, "utf8");
const M = "V1010241_SINGLE_RECOVERY_OWNER";

if (s.includes(M)) {
  console.log("[info] client .241 already applied");
  process.exit(0);
}

const beforeGuard = `      this.room !== sourceRoom ||
      this.manualReconnectInFlight ||
      sourceRoom.reconnection
        .isReconnecting`;

const afterGuard = `      this.room !== sourceRoom ||
      this.manualReconnectInFlight ||
      this.freshRejoinInFlight ||
      sourceRoom.reconnection
        .isReconnecting`;

if (!s.includes(beforeGuard)) {
  throw new Error("manual reconnect guard anchor not found. Send latest MultiplayerClient.ts.");
}
s = s.replace(beforeGuard, afterGuard);

const beforeReset = `    this.connectionIssueNotified =
      false;
this.manualReconnectInFlight = false;
    this.lastManualReconnectAt = 0;`;

const afterReset = `    this.connectionIssueNotified =
      false;
    /* ${M}: do not clear an in-flight recovery owner inside attachRoom(). */
    this.lastManualReconnectAt = 0;`;

if (!s.includes(beforeReset)) {
  throw new Error("attachRoom recovery reset anchor not found. Send latest MultiplayerClient.ts.");
}
s = s.replace(beforeReset, afterReset);

if (!s.includes(M)) {
  throw new Error("client patch verification failed");
}

fs.writeFileSync(file, s, "utf8");

console.log("[done] CLIENT v0.10.10.241 applied");
console.log("[ok] manual reconnect cannot start while fresh rejoin owns recovery");
console.log("[ok] attachRoom no longer clears the active reconnect lock");
console.log("Next: npm run build");
