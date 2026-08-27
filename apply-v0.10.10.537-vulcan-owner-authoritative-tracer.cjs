const fs=require("fs"),path=require("path");
const FILE=path.join("src","game","GameScene.ts");
const MARK="V1010537_VULCAN_OWNER_AUTHORITATIVE_TRACER";
if(!fs.existsSync(FILE)) throw new Error(`Missing ${FILE}. Run from C:\\Users\\bak12\\color-hunt. No file written.`);
let s=fs.readFileSync(FILE,"utf8").replace(/\r\n/g,"\n"), original=s;
if(s.includes(MARK)){console.log("[skip] v537 already applied.");process.exit(0);}

/*
Root cause:
v530f intentionally removed spawnVulcanPresentationImpact(vulcanDisplayX/Y)
from the active Hunter firing loop and replaced it with sound only.
The network vulcan_fired callback currently draws only an authoritative circle.
Meanwhile passive Hider self-view still calls spawnVulcanPresentationImpact(),
so Hiders see the straight tracer but the firing Hunter does not.

Fix:
Draw ONE authoritative tracer at shot.x/y only for the local shooter.
Hiders keep their existing passive presentation, avoiding duplicate Hider tracers.
*/

const cbStart=s.indexOf("            multiplayerClient.onVulcanFired((shot: NetworkVulcanFired) => {");
if(cbStart<0) throw new Error("onVulcanFired callback not found. No file written.");
const cbEnd=s.indexOf("\n            }),",cbStart);
if(cbEnd<0) throw new Error("onVulcanFired callback end not found. No file written.");
let cb=s.slice(cbStart,cbEnd);

if(!cb.includes("shot.x")||!cb.includes("shot.y"))
  throw new Error("Current authoritative impact callback shape differs. No file written.");
if(!cb.includes("const impact"))
  throw new Error("Current callback no longer appears to draw authoritative impact. No file written.");

const insertNeedles=[
`                const impact =
                    this.add`,
`                const impact =
                    this.add
`,
];
let insertAt=-1;
for(const needle of insertNeedles){
  const i=cb.indexOf(needle);
  if(i>=0){insertAt=i;break;}
}
if(insertAt<0) throw new Error("Authoritative impact creation anchor not found. No file written.");

const ownerTracer=`                /*
                 * ${MARK}
                 * v530f removed the local synthetic tracer to keep impacts
                 * server-authoritative. Restore ONLY the firing Hunter's
                 * straight tracer, at the exact authoritative shot.x/y.
                 *
                 * Hider self-view already has its passive shared tracer path,
                 * so shooterId gating prevents double tracer rendering there.
                 */
                if (
                    shot.shooterId ===
                    multiplayerClient.getSessionId()
                ) {
                    const ownerTracer =
                        this.add
                            .rectangle(
                                impactX -
                                    36,
                                impactY -
                                    8,
                                Phaser.Math.Between(
                                    36,
                                    68,
                                ),
                                2,
                                0xffcf54,
                                0.96,
                            )
                            .setAngle(
                                Phaser.Math.Between(
                                    -24,
                                    24,
                                ),
                            )
                            .setDepth(
                                25030,
                            );

                    this.vulcanImpactFx
                        .add(
                            ownerTracer,
                        );

                    this.tweens.add({
                        targets:
                            ownerTracer,
                        alpha:
                            0,
                        duration:
                            135,
                        ease:
                            'Quad.Out',
                        onComplete:
                            () => {
                                this.vulcanImpactFx
                                    .delete(
                                        ownerTracer,
                                    );

                                ownerTracer
                                    .destroy();
                            },
                    });
                }

`;

cb=cb.slice(0,insertAt)+ownerTracer+cb.slice(insertAt);
s=s.slice(0,cbStart)+cb+s.slice(cbEnd);
s=`/* ${MARK}: local firing Hunter receives authoritative Vulcan tracer at shot.x/y; Hider passive path remains single-rendered. */\n`+s;

/* Safety */
const finalCb=s.slice(
  s.indexOf("            multiplayerClient.onVulcanFired((shot: NetworkVulcanFired) => {"),
  s.indexOf("\n            }),",s.indexOf("            multiplayerClient.onVulcanFired((shot: NetworkVulcanFired) => {"))
);
if(!/shot\.shooterId\s*===\s*multiplayerClient\.getSessionId\(\)/.test(finalCb))
  throw new Error("Postcondition failed: local-shooter gate missing. No file written.");
if(!/Phaser\.Math\.Between\(\s*36\s*,\s*68/.test(finalCb))
  throw new Error("Postcondition failed: 36..68 owner tracer missing. No file written.");
if(!/\.setDepth\(\s*25030/.test(finalCb))
  throw new Error("Postcondition failed: owner tracer depth missing. No file written.");
if(!/const impactX[\s\S]*?shot\.x/.test(finalCb)||!/const impactY[\s\S]*?shot\.y/.test(finalCb))
  throw new Error("Postcondition failed: authoritative coordinates missing. No file written.");

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v537.ts"),original,"utf8");
fs.writeFileSync(FILE,s,"utf8");

console.log("Applied v0.10.10.537.");
console.log(" - root cause fixed: v530f had removed Hunter local tracer rendering");
console.log(" - firing Hunter now sees a tracer at exact server shot.x/y");
console.log(" - owner tracer length is 36..68px (2x original)");
console.log(" - owner tracer depth raised to 25030 for aerial view visibility");
console.log(" - Hider passive tracer path is untouched, so no Hider duplicate is added");
console.log(" - impact circle / spotlight / 15px server spread / damage untouched");
console.log("Next: npm run build");
