const fs = require("fs");
const path = require("path");

const target = path.join(process.cwd(), "src", "rooms", "MyRoom.ts");

if (!fs.existsSync(target)) {
  throw new Error(`Target not found: ${target}`);
}

const source = fs.readFileSync(target, "utf8");

const oldBlock = `            const normalized =
              Math.min(
                1,
                Math.sqrt(
                  d2,
                ),
              );

            const perTickChance =
              0.095 -
              normalized *
                0.055;

            if (
              Math.random() >
              perTickChance
            ) {
              continue;
            }
`;

const newBlock = `            /*
             * V1010529B_VULCAN_RELIABLE_AREA_HIT:
             * The server already authoritatively confirmed that this living
             * Hider is inside the Vulcan ellipse (d2 <= 1). Do not roll a
             * second random hit lottery here: that made sustained Vulcan fire
             * visibly pass over valid targets without registering a hit.
             *
             * Keep the existing ellipse/hitbox untouched; only remove the
             * probabilistic rejection after the authoritative overlap test.
             */
`;

const occurrences = source.split(oldBlock).length - 1;

if (occurrences !== 1) {
  throw new Error(
    `Expected exactly 1 Vulcan probabilistic hit block, found ${occurrences}. No file written.`
  );
}

const output = source.replace(oldBlock, newBlock);

fs.copyFileSync(target, `${target}.bak-v0.10.10.529b`);
fs.writeFileSync(target, output, "utf8");

console.log("Applied v0.10.10.529b: Vulcan authoritative ellipse hit is now deterministic.");
console.log("Backup:", `${target}.bak-v0.10.10.529b`);
