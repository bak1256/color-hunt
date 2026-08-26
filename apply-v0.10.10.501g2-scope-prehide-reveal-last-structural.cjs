const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "src", "game", "GameScene.ts");
const MARK = "V1010501G2_SCOPE_PREHIDE_REVEAL_LAST_STRUCTURAL";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt project root.");
}

let src = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (src.includes(MARK)) {
  console.log("[skip] v0.10.10.501g2 already applied");
  process.exit(0);
}

const original = src;

function findMethodRange(source, methodName) {
  const re = new RegExp(
    `^[ \\t]*private[ \\t]+${methodName}\\s*\\(`,
    "m",
  );

  const match = source.match(re);

  if (!match || match.index == null) {
    throw new Error(`${methodName}() not found. No file written.`);
  }

  const start = match.index;
  const brace = source.indexOf("{", start);

  if (brace < 0) {
    throw new Error(`${methodName}() opening brace missing. No file written.`);
  }

  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1] || "";

    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === "\\") {
        escaped = true;
        continue;
      }

      if (ch === quote) quote = "";
      continue;
    }

    if (ch === "/" && next === "/") {
      lineComment = true;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      blockComment = true;
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "{") {
      depth += 1;
      continue;
    }

    if (ch === "}") {
      depth -= 1;

      if (depth === 0) {
        return { start, brace, end: i + 1 };
      }
    }
  }

  throw new Error(`${methodName}() closing brace missing. No file written.`);
}

function replaceMethod(methodName, editor) {
  const range = findMethodRange(src, methodName);
  const method = src.slice(range.start, range.end);
  const edited = editor(method);

  if (edited === method) {
    throw new Error(`${methodName}(): no change made. No file written.`);
  }

  src =
    src.slice(0, range.start) +
    edited +
    src.slice(range.end);
}

function insertAfterOpeningBrace(method, text) {
  const brace = method.indexOf("{");

  if (brace < 0) {
    throw new Error("Opening brace not found.");
  }

  return (
    method.slice(0, brace + 1) +
    text +
    method.slice(brace + 1)
  );
}

function insertBeforeClosingBrace(method, text) {
  const close = method.lastIndexOf("}");

  if (close < 0) {
    throw new Error("Closing brace not found.");
  }

  return (
    method.slice(0, close) +
    text +
    method.slice(close)
  );
}

/* 1) Clean start: hide anything left from normal aim/scope immediately. */
replaceMethod(
  "enterSniperCinematic",
  (method) => {
    if (method.includes("V1010501G2_CLEAN_SCOPE_START")) {
      return method;
    }

    return insertAfterOpeningBrace(
      method,
      `

        /*
         * V1010501G2_CLEAN_SCOPE_START
         * Transition-order fix only. No blur/mask/zoom geometry changes.
         */
        this.aimLine
            ?.clear()
            .setVisible(false);

        this.crosshair
            ?.clear()
            .setVisible(false);

        this.sniperScope
            ?.clear()
            .setVisible(false);

        this.sniperScopeShade
            ?.clear()
            .setVisible(false);

        this.sniperReloadGraphics
            ?.clear()
            .setVisible(false);

        this.sniperScopeCamera
            ?.setVisible(false);
`,
    );
  },
);

/* 2) Newly-created magnified camera must finish the creation method hidden.
 * Synchronous method execution completes before Phaser renders the next frame,
 * so this structurally avoids relying on a particular cameras.add() spelling.
 */
replaceMethod(
  "createSniperScopeCamera",
  (method) => {
    if (method.includes("V1010501G2_SCOPE_CAMERA_PREHIDE")) {
      return method;
    }

    return insertBeforeClosingBrace(
      method,
      `

        /*
         * V1010501G2_SCOPE_CAMERA_PREHIDE
         * Keep the magnified camera hidden until drawLocalSniperScope()
         * has finished drawing the outside treatment + reticle.
         */
        this.sniperScopeCamera
            ?.setVisible(false);
`,
    );
  },
);

/* 3) Reveal magnified camera LAST in the draw method.
 * No exact gauge/reticle anchor required.
 */
replaceMethod(
  "drawLocalSniperScope",
  (method) => {
    if (method.includes("V1010501G2_SCOPE_REVEAL_LAST")) {
      return method;
    }

    return insertBeforeClosingBrace(
      method,
      `

        /*
         * V1010501G2_SCOPE_REVEAL_LAST
         * Reveal only after this entire scope draw method has completed
         * its blur/shade/frame/reticle work.
         */
        this.sniperScopeCamera
            ?.setVisible(true);
`,
    );
  },
);

src =
  `/* ${MARK}: structural prehide/reveal-last regression fix; current blur and scope geometry untouched. */\n` +
  src;

for (const token of [
  MARK,
  "V1010501G2_CLEAN_SCOPE_START",
  "V1010501G2_SCOPE_CAMERA_PREHIDE",
  "V1010501G2_SCOPE_REVEAL_LAST",
]) {
  if (!src.includes(token)) {
    throw new Error(`Safety assertion failed: ${token}. No file written.`);
  }
}

fs.mkdirSync(".patch-backups", { recursive: true });

fs.writeFileSync(
  ".patch-backups/GameScene-before-v501g2.ts",
  original,
  "utf8",
);

fs.writeFileSync(FILE, src, "utf8");

console.log("");
console.log("[done] v0.10.10.501g2 CLIENT");
console.log("[fix] scope camera hidden throughout creation");
console.log("[fix] scope camera revealed only at end of drawLocalSniperScope()");
console.log("[fix] old aim/scope layers hidden at sniper transition start");
console.log("[unchanged] current outside blur");
console.log("[unchanged] current scope radius/mask/zoom/fire/aim movement");
console.log("[backup] .patch-backups/GameScene-before-v501g2.ts");
console.log("Next: npm run build");
