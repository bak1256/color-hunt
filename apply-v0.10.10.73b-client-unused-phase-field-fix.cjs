const fs = require("fs");

const file = "src/network/MultiplayerClient.ts";
let s = fs.readFileSync(file, "utf8");

let removed = 0;

/* Remove the unused field declaration regardless of spacing. */
s = s.replace(
  /^\s*private\s+deliveredPhaseEndsAt\s*=\s*0;\s*$/gm,
  () => {
    removed += 1;
    return "";
  },
);

/* Remove every assignment statement to the unused field. */
s = s.replace(
  /\s*this\.deliveredPhaseEndsAt\s*=\s*[^;]+;\s*/g,
  () => {
    removed += 1;
    return "\n";
  },
);

/* Final fallback: remove any remaining standalone line containing the symbol. */
s = s.replace(
  /^.*deliveredPhaseEndsAt.*(?:\r?\n|$)/gm,
  () => {
    removed += 1;
    return "";
  },
);

if (s.includes("deliveredPhaseEndsAt")) {
  throw new Error(
    "Could not fully remove deliveredPhaseEndsAt",
  );
}

fs.writeFileSync(file, s, "utf8");

console.log(
  `[ok] removed ${removed} deliveredPhaseEndsAt declaration/reference(s)`,
);
console.log(
  "[done] v0.10.10.73b client build fix applied",
);
console.log("Next: npm run build");
