const fs=require("fs"),path=require("path");
const FILE=path.join("src","game","GameScene.ts");
const MARK="V1010534B_REMOVE_HUNT_INTRO_ROBUST";
if(!fs.existsSync(FILE)) throw new Error(`Missing ${FILE}. Run from project root. No file written.`);
let s=fs.readFileSync(FILE,"utf8").replace(/\r\n/g,"\n"), original=s;
if(s.includes(MARK)){console.log("[skip] v534b already applied.");process.exit(0);}

function methodRange(name){
  const start=s.indexOf(`    private ${name}(`);
  if(start<0) throw new Error(`${name}() not found. No file written.`);
  const next=s.indexOf("\n    private ",start+20);
  if(next<0) throw new Error(`Could not isolate ${name}(). No file written.`);
  return [start,next];
}
const cleanup=`        /*
         * ${MARK}
         * Hunt-start DOM intro is valid only during live Hunt.
         * Kill it immediately before WIN / LOSE can render.
         */
        document
            .querySelector(
                '.colorhunt-main-hunt-intro',
            )
            ?.remove();

`;

/* 1. round_result: avoid brittle comments/formatting. Insert directly after
 * the first real roundResultWinner assignment inside this method.
 */
let [a,b]=methodRange("handleNetworkRoundResult");
let m=s.slice(a,b);
if(!m.includes(".colorhunt-main-hunt-intro")){
  const re=/^(\s*)this\.roundResultWinner\s*=\s*result\.winner\s*;\s*$/m;
  const hit=m.match(re);
  if(!hit) throw new Error("roundResultWinner=result.winner assignment not found in handleNetworkRoundResult(). No file written.");
  const pos=(hit.index??0)+hit[0].length;
  m=m.slice(0,pos)+"\n\n"+cleanup+m.slice(pos).replace(/^\n+/,"");
  s=s.slice(0,a)+m+s.slice(b);
}

/* 2. phase ownership: insert at the START of applyNetworkPhase(), before
 * any finished/lobby/result branch. No dependency on fart-coach code.
 */
[a,b]=methodRange("applyNetworkPhase");
m=s.slice(a,b);
if(!m.includes(`${MARK} / PHASE_OWNERSHIP`)){
  const brace=m.indexOf("{");
  if(brace<0) throw new Error("applyNetworkPhase opening brace not found. No file written.");
  const block=`
        /*
         * ${MARK} / PHASE_OWNERSHIP
         * A delayed Hunt intro must never survive Finished/Lobby/Paint.
         */
        if (phase !== 'hunt') {
            document
                .querySelector(
                    '.colorhunt-main-hunt-intro',
                )
                ?.remove();
        }
`;
  m=m.slice(0,brace+1)+block+m.slice(brace+1);
  s=s.slice(0,a)+m+s.slice(b);
}

if(!s.includes(MARK)) throw new Error("Marker missing after patch. No file written.");
const rr=s.slice(...methodRange("handleNetworkRoundResult"));
if(!rr.includes(".colorhunt-main-hunt-intro")) throw new Error("round_result cleanup postcheck failed. No file written.");
const ph=s.slice(...methodRange("applyNetworkPhase"));
if(!ph.includes(".colorhunt-main-hunt-intro") || !ph.includes("phase !== 'hunt'")) throw new Error("phase cleanup postcheck failed. No file written.");

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v534b.ts"),original,"utf8");
fs.writeFileSync(FILE,`/* ${MARK}: prevent Hunt intro from overlapping final result. */\n`+s,"utf8");
console.log("[done] v0.10.10.534b applied");
console.log("[ok] round_result removes Hunt intro immediately");
console.log("[ok] every non-Hunt phase removes Hunt intro immediately");
console.log("[safe] no exact old comment/fart-coach anchor required");
console.log("Next: npm run build");
