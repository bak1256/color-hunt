const fs = require("fs");

const file = "src/network/MultiplayerClient.ts";
let s = fs.readFileSync(file, "utf8");

const field = `  private deliveredPhaseEndsAt = 0;\n`;
if (s.includes(field)) {
  s = s.replace(field, "");
  console.log("[ok] removed unused deliveredPhaseEndsAt field");
}

const samePhaseAssignment = `      this.deliveredPhaseEndsAt =
        normalizedEndsAt;
`;
if (s.includes(samePhaseAssignment)) {
  s = s.replace(samePhaseAssignment, "");
  console.log("[ok] removed unused same-phase deadline assignment");
}

const changedPhaseAssignment = `    this.deliveredPhaseEndsAt =
      normalizedEndsAt;

`;
if (s.includes(changedPhaseAssignment)) {
  s = s.replace(changedPhaseAssignment, "");
  console.log("[ok] removed unused phase deadline assignment");
}

if (s.includes("deliveredPhaseEndsAt")) {
  throw new Error("deliveredPhaseEndsAt still exists; aborting");
}

fs.writeFileSync(file, s, "utf8");

console.log("[done] v0.10.10.73a client build fix applied");
console.log("Next: npm run build");
