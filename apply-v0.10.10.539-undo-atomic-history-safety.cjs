const fs=require("fs"),path=require("path");
const GAME=path.join("src","game","GameScene.ts");
const MARK="V1010539_UNDO_ATOMIC_HISTORY_SAFETY";
if(!fs.existsSync(GAME)) throw new Error(`Missing ${GAME}. Run from C:\\Users\\bak12\\color-hunt.`);
let s=fs.readFileSync(GAME,"utf8").replace(/\r\n/g,"\n"), orig=s;
if(s.includes(MARK)){console.log("[skip] v539 already applied");process.exit(0);}

/* Add generation token beside existing rebuild timer.  Every undo/redo request
   gets a generation.  A stale delayed callback is never allowed to rebuild an
   older/empty transient state. */
const timerDecl=/(\s+private paintHistoryRebuildTimer\s*:\s*number\s*\|\s*undefined\s*=\s*undefined\s*;)/;
if(timerDecl.test(s)){
  s=s.replace(timerDecl,`$1
    /* ${MARK}: stale Undo/Redo rebuild callbacks may never win. */
    private paintHistoryRebuildGeneration = 0;
    private paintHistoryLastNonEmptySnapshot: NetworkPaintStroke[] = [];`);
}else if(!s.includes("paintHistoryRebuildGeneration")){
  throw new Error("paintHistoryRebuildTimer declaration not found. No file written.");
}

/* Snapshot helper: copy strokes deeply enough that later point-array mutation
   cannot destroy the emergency copy. */
const schedAnchor="    private schedulePaintHistoryRebuild(): void {";
if(!s.includes(schedAnchor)) throw new Error("schedulePaintHistoryRebuild() not found. No file written.");
if(!s.includes("private snapshotLocalPaintHistoryForUndoSafety")){
  const helper=`    private snapshotLocalPaintHistoryForUndoSafety(): void {
        if (this.localPaintHistory.length === 0) {
            return;
        }

        this.paintHistoryLastNonEmptySnapshot =
            this.localPaintHistory.map(
                (stroke) => ({
                    ...stroke,
                    points: stroke.points.map(
                        (point) => ({
                            ...point,
                        }),
                    ),
                }),
            );
    }

`;
  s=s.replace(schedAnchor,helper+schedAnchor);
}

/* Replace scheduler body by method-boundary isolation. */
{
 const a=s.indexOf(schedAnchor), b=s.indexOf("\n    private ",a+schedAnchor.length);
 if(a<0||b<0) throw new Error("Could not isolate schedulePaintHistoryRebuild(). No file written.");
 const old=s.slice(a,b);
 const neu=`    private schedulePaintHistoryRebuild(): void {
        /*
         * ${MARK} / LAST_REQUEST_WINS
         *
         * Undo/Redo may be clicked repeatedly. Collapse the burst into one
         * atomic rebuild and invalidate every older delayed callback.
         */
        const generation =
            ++this.paintHistoryRebuildGeneration;

        if (
            this.paintHistoryRebuildTimer !==
            undefined
        ) {
            window.clearTimeout(
                this.paintHistoryRebuildTimer,
            );
        }

        this.paintHistoryRebuildTimer =
            window.setTimeout(
                () => {
                    if (
                        generation !==
                        this.paintHistoryRebuildGeneration
                    ) {
                        return;
                    }

                    this.paintHistoryRebuildTimer =
                        undefined;

                    this.rebuildLocalPaintFromHistory();
                },
                42,
            );
    }
`;
 s=s.slice(0,a)+neu+s.slice(b);
}

/* Before destructive Undo pop, retain the complete current picture.
   Do NOT restore when the user legitimately undoes the final remaining stroke:
   that should become empty. The backup is diagnostic/emergency state and also
   protects against accidental external history clearing during a queued burst. */
const popAnchor=`        const removedStroke =
            this.localPaintHistory.pop();`;
if(!s.includes(popAnchor)) throw new Error("Undo pop anchor not found. No file written.");
s=s.replace(popAnchor,`        this.snapshotLocalPaintHistoryForUndoSafety();

${popAnchor}`);

/* New paint after Undo must invalidate Redo as normal. We don't alter that
   policy. Add a pre-rebuild invariant: if history became empty even though the
   removed stroke was NOT the only stroke in the backed-up picture, recover the
   expected remaining strokes. */
const removedCheck=`        if (!removedStroke) {
            return;
        }`;
if(!s.includes(removedCheck)) throw new Error("Undo removed-stroke check not found. No file written.");
s=s.replace(removedCheck,`${removedCheck}

        /*
         * ${MARK} / IMPOSSIBLE_EMPTY_GUARD
         * If there were 2+ strokes before one Undo, one Undo cannot legally
         * produce an empty history. Recover the pre-Undo snapshot minus the
         * final stroke instead of broadcasting a blank reset.
         */
        if (
            this.localPaintHistory.length === 0 &&
            this.paintHistoryLastNonEmptySnapshot.length > 1
        ) {
            this.localPaintHistory.push(
                ...this.paintHistoryLastNonEmptySnapshot
                    .slice(0, -1)
                    .map(
                        (stroke) => ({
                            ...stroke,
                            points: stroke.points.map(
                                (point) => ({
                                    ...point,
                                }),
                            ),
                        }),
                    ),
            );
        }`);

/* Ensure rebuild itself never sends a reset from an impossible transient empty
   history while an Undo/Redo burst is queued. Legitimate final-stroke Undo is
   allowed because backup size is exactly 1. */
const rebuildAnchor="    private rebuildLocalPaintFromHistory(";
const ra=s.indexOf(rebuildAnchor);
if(ra<0) throw new Error("rebuildLocalPaintFromHistory() not found. No file written.");
const brace=s.indexOf("{",ra);
if(brace<0) throw new Error("rebuildLocalPaintFromHistory body not found.");
s=s.slice(0,brace+1)+`
        /*
         * ${MARK} / BLANK_RESET_FIREWALL
         * A single Undo may only blank the canvas when exactly one stroke
         * existed before it. Never broadcast a transient accidental empty.
         */
        if (
            this.localPaintHistory.length === 0 &&
            this.paintHistoryLastNonEmptySnapshot.length > 1
        ) {
            this.localPaintHistory.push(
                ...this.paintHistoryLastNonEmptySnapshot
                    .slice(0, -1)
                    .map(
                        (stroke) => ({
                            ...stroke,
                            points: stroke.points.map(
                                (point) => ({
                                    ...point,
                                }),
                            ),
                        }),
                    ),
            );
        }
`+s.slice(brace+1);

s=`/* ${MARK}: Undo/Redo rebuilds are last-request-wins; impossible blank resets are blocked. */\n`+s;

for(const [label,ok] of [
 ["generation",s.includes("paintHistoryRebuildGeneration")],
 ["snapshot",s.includes("snapshotLocalPaintHistoryForUndoSafety")],
 ["empty guard",s.includes("IMPOSSIBLE_EMPTY_GUARD")],
 ["reset firewall",s.includes("BLANK_RESET_FIREWALL")],
 ["undo retained",s.includes("this.localPaintHistory.pop()")],
 ["redo retained",s.includes("this.redoPaintHistory.pop()")],
]) if(!ok) throw new Error(`Postcondition failed: ${label}. No file written.`);

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v539.ts"),orig,"utf8");
fs.writeFileSync(GAME,s,"utf8");
console.log("Applied v0.10.10.539.");
console.log(" - rapid Undo/Redo: last rebuild request wins");
console.log(" - stale 42ms rebuild callbacks cannot overwrite newer state");
console.log(" - one Undo cannot accidentally erase a 2+ stroke painting");
console.log(" - legitimate Undo of the only remaining stroke still clears canvas");
console.log(" - blank multiplayer reset is blocked for impossible-empty state");
console.log(" - backup: .patch-backups/GameScene-before-v539.ts");
console.log("Next: npm run build");
