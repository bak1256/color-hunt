const fs=require("fs"),path=require("path");
const FILE=path.join("src","game","GameScene.ts");
const MARK="V1010534_REMOVE_HUNT_INTRO_ON_ROUND_END";
if(!fs.existsSync(FILE)) throw new Error(`Missing ${FILE}. Run from C:\\Users\\bak12\\color-hunt. No file written.`);
let s=fs.readFileSync(FILE,"utf8").replace(/\r\n/g,"\n"), original=s;
if(s.includes(MARK)){console.log("[skip] v534 already applied.");process.exit(0);}

const sig="    private handleNetworkRoundResult(";
const a=s.indexOf(sig);
if(a<0) throw new Error("handleNetworkRoundResult() not found. No file written.");
const b=s.indexOf("\n    private ",a+sig.length);
if(b<0) throw new Error("Could not isolate handleNetworkRoundResult(). No file written.");
let m=s.slice(a,b);

const anchor=`        this.roundResultWinner = result.winner;

        /*
         * v0.10.10.96:`;

if(!m.includes(anchor)) throw new Error("round-result cleanup anchor not found. No file written.");

m=m.replace(anchor,`        this.roundResultWinner = result.winner;

        /*
         * ${MARK}
         * The Hunt-start DOM intro ("하이더를 찾자!" / "헌터를 피해 숨자!")
         * owns its own 1.5s window timer. If the round ends during that window,
         * its delayed DOM removal can outlive Hunt and overlap WIN / LOSE.
         * Round result is authoritative: remove the intro immediately.
         */
        document
            .querySelector(
                '.colorhunt-main-hunt-intro',
            )
            ?.remove();

        /*
         * v0.10.10.96:`);

s=s.slice(0,a)+m+s.slice(b);

/* Also clean on ANY non-hunt network phase. This covers packet ordering where
 * Finished arrives before round_result and makes the DOM intro phase-owned.
 */
const phaseSig="    private applyNetworkPhase(";
const pa=s.indexOf(phaseSig);
if(pa<0) throw new Error("applyNetworkPhase() not found. No file written.");
const pb=s.indexOf("\n    private ",pa+phaseSig.length);
if(pb<0) throw new Error("Could not isolate applyNetworkPhase(). No file written.");
let pm=s.slice(pa,pb);

const phaseAnchor=`        if (
            phase !== 'hunt'
        ) {
            this.destroyHunterFartCoach();
        }`;

if(!pm.includes(phaseAnchor)) throw new Error("non-Hunt cleanup anchor not found. No file written.");

pm=pm.replace(phaseAnchor,`        if (
            phase !== 'hunt'
        ) {
            this.destroyHunterFartCoach();

            /*
             * ${MARK} / PHASE_OWNERSHIP
             * Hunt intro is valid only while phase === 'hunt'.
             */
            document
                .querySelector(
                    '.colorhunt-main-hunt-intro',
                )
                ?.remove();
        }`);

s=s.slice(0,pa)+pm+s.slice(pb);

s=`/* ${MARK}: Hunt-start DOM intro cannot survive into Finished/WIN/LOSE. */\n`+s;

const removes=(s.match(/querySelector\(\s*'\.colorhunt-main-hunt-intro'/g)||[]).length;
if(removes<3) throw new Error(`Postcondition failed: expected existing create cleanup + 2 round-end cleanups, found ${removes}. No file written.`);
if(!/handleNetworkRoundResult[\s\S]{0,4000}?\.colorhunt-main-hunt-intro/.test(s))
  throw new Error("Postcondition failed: round_result cleanup missing. No file written.");
if(!/applyNetworkPhase[\s\S]{0,1800}?phase !== 'hunt'[\s\S]{0,900}?\.colorhunt-main-hunt-intro/.test(s))
  throw new Error("Postcondition failed: non-Hunt phase cleanup missing. No file written.");

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v534.ts"),original,"utf8");
fs.writeFileSync(FILE,s,"utf8");

console.log("Applied v0.10.10.534.");
console.log(" - Hunt intro DOM text is removed immediately on round_result");
console.log(" - Hunt intro DOM text is also removed on every non-Hunt phase");
console.log(" - WIN / LOSE can no longer overlap with 'Find the Hiders!' / Hider hide intro");
console.log(" - intro timing during normal Hunt start is unchanged");
console.log(" - server source unchanged");
console.log("Next: npm run build");
