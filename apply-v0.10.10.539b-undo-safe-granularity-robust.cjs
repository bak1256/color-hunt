const fs=require("fs"),path=require("path");
const GAME=path.join("src","game","GameScene.ts");
const MARK="V1010539B_UNDO_SAFE_GRANULARITY_ROBUST";
if(!fs.existsSync(GAME)) throw new Error(`Missing ${GAME}. Run from C:\\Users\\bak12\\color-hunt.`);
let s=fs.readFileSync(GAME,"utf8").replace(/\r\n/g,"\n"), orig=s;
if(s.includes(MARK)){console.log("[skip] v539b already applied");process.exit(0);}

/* Current source uses:
 *   private paintHistoryRebuildTimer?: number;
 * v539 assumed a different declaration shape. Insert state using a tolerant
 * anchor around the actual Undo/Redo fields instead of requiring one timer type.
 */
const fieldAnchor=/(\s+private redoPaintHistory:\s*NetworkPaintStroke\[\]\s*=\s*\[\];)/;
if(!fieldAnchor.test(s)) throw new Error("redoPaintHistory field not found. No file written.");
s=s.replace(fieldAnchor,`$1
    /* ${MARK}: Undo rebuild is last-request-wins and keeps an emergency snapshot. */
    private paintHistoryRebuildGeneration = 0;
    private paintHistoryLastNonEmptySnapshot: NetworkPaintStroke[] = [];`);

/* Deep-clone helper before scheduler. */
const schedSig="    private schedulePaintHistoryRebuild(): void {";
if(!s.includes(schedSig)) throw new Error("schedulePaintHistoryRebuild() not found. No file written.");
const helper=`    private clonePaintHistory(
        history: NetworkPaintStroke[],
    ): NetworkPaintStroke[] {
        return history.map(
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

    private rememberPaintHistoryForUndoSafety(): void {
        if (
            this.localPaintHistory.length >
            0
        ) {
            this.paintHistoryLastNonEmptySnapshot =
                this.clonePaintHistory(
                    this.localPaintHistory,
                );
        }
    }

`;
s=s.replace(schedSig,helper+schedSig);

/* Replace scheduler by method boundaries. */
{
 const a=s.indexOf(schedSig), b=s.indexOf("\n    private ",a+schedSig.length);
 if(a<0||b<0) throw new Error("Could not isolate schedulePaintHistoryRebuild(). No file written.");
 const neu=`    private schedulePaintHistoryRebuild(): void {
        /*
         * ${MARK} / LAST_REQUEST_WINS
         * Rapid Undo/Redo taps collapse into the latest requested history.
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

/* Undo safety:
 *  - remember the exact pre-Undo history
 *  - if one Undo would unexpectedly empty a 2+ stroke history, restore all but last
 *  - if the whole visible painting is genuinely ONE giant continuous stroke,
 *    do not delete the whole thing in one click. Split that stroke into an
 *    8-point tail undo unit so Undo feels incremental instead of "everything vanished".
 *
 * Redo receives the removed tail as a normal stroke, so Redo restores it.
 */
const undoSig="    private undoLastPaintStroke(): void {";
let ua=s.indexOf(undoSig), ub=s.indexOf("\n    private ",ua+undoSig.length);
if(ua<0||ub<0) throw new Error("Could not isolate undoLastPaintStroke(). No file written.");
let um=s.slice(ua,ub);

const finishAnchor=`        this.finishActivePaintStroke();

        const removedStroke =
            this.localPaintHistory.pop();`;
if(!um.includes(finishAnchor)) throw new Error("Undo pop block differs. No file written.");

um=um.replace(finishAnchor,`        this.finishActivePaintStroke();

        this.rememberPaintHistoryForUndoSafety();

        let removedStroke =
            this.localPaintHistory.pop();

        /*
         * ${MARK} / GIANT_SINGLE_STROKE_GUARD
         *
         * A player may paint almost the whole character without releasing the
         * pointer. Technically that is one stroke, so legacy Undo erased the
         * entire painting at once. If the only stroke is large, undo only its
         * newest tail and keep the earlier part as the remaining stroke.
         */
        if (
            removedStroke &&
            this.localPaintHistory.length ===
                0 &&
            this.paintHistoryLastNonEmptySnapshot.length ===
                1 &&
            removedStroke.points.length >
                16
        ) {
            const undoPointCount =
                Math.min(
                    8,
                    Math.max(
                        4,
                        Math.floor(
                            removedStroke.points.length *
                                0.10,
                        ),
                    ),
                );

            const splitIndex =
                Math.max(
                    1,
                    removedStroke.points.length -
                        undoPointCount,
                );

            const remainingStroke:
                NetworkPaintStroke = {
                    ...removedStroke,
                    points:
                        removedStroke.points
                            .slice(
                                0,
                                splitIndex,
                            )
                            .map(
                                (point) => ({
                                    ...point,
                                }),
                            ),
                };

            const tailStroke:
                NetworkPaintStroke = {
                    ...removedStroke,
                    points:
                        removedStroke.points
                            .slice(
                                splitIndex,
                            )
                            .map(
                                (point) => ({
                                    ...point,
                                }),
                            ),
                };

            this.localPaintHistory.push(
                remainingStroke,
            );

            removedStroke =
                tailStroke;
        }`);

const removedCheck=`        if (!removedStroke) {
            return;
        }`;
if(!um.includes(removedCheck)) throw new Error("Undo removed check differs. No file written.");
um=um.replace(removedCheck,`${removedCheck}

        /*
         * ${MARK} / IMPOSSIBLE_EMPTY_GUARD
         * With 2+ stored strokes, one Undo cannot legally erase all history.
         */
        if (
            this.localPaintHistory.length ===
                0 &&
            this.paintHistoryLastNonEmptySnapshot.length >
                1
        ) {
            const restoredRemaining =
                this.paintHistoryLastNonEmptySnapshot
                    .slice(
                        0,
                        -1,
                    );

            this.localPaintHistory.push(
                ...this.clonePaintHistory(
                    restoredRemaining,
                ),
            );
        }`);

s=s.slice(0,ua)+um+s.slice(ub);

/* Mark final source. */
s=`/* ${MARK}: Undo no longer wipes a large one-stroke painting; rebuild callbacks are generation-safe. */\n`+s;

for(const [label,ok] of [
 ["generation",s.includes("paintHistoryRebuildGeneration")],
 ["clone helper",s.includes("clonePaintHistory(")],
 ["giant-stroke guard",s.includes("GIANT_SINGLE_STROKE_GUARD")],
 ["impossible-empty guard",s.includes("IMPOSSIBLE_EMPTY_GUARD")],
 ["redo preserved",s.includes("this.redoPaintHistory.push(")],
 ["scheduler preserved",s.includes("window.setTimeout(")],
]) if(!ok) throw new Error(`Postcondition failed: ${label}. No file written.`);

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v539b.ts"),orig,"utf8");
fs.writeFileSync(GAME,s,"utf8");
console.log("Applied v0.10.10.539b.");
console.log(" - supports current `private paintHistoryRebuildTimer?: number` source shape");
console.log(" - rapid Undo/Redo rebuild callbacks are generation-safe");
console.log(" - 2+ stroke history cannot become blank from one Undo");
console.log(" - one huge continuous stroke is undone incrementally instead of all-at-once");
console.log(" - Redo still restores the removed tail normally");
console.log(" - backup: .patch-backups/GameScene-before-v539b.ts");
console.log("Next: npm run build");
