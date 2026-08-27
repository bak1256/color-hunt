const fs=require("fs"),path=require("path");
const FILE=path.join("src","network","MultiplayerClient.ts");
const MARK="V1010540_RECONNECT_GRACE_REAL_DROP_UI_DEDUPE";
if(!fs.existsSync(FILE)) throw new Error(`Missing ${FILE}. Run from C:\\Users\\bak12\\color-hunt. No file written.`);
let s=fs.readFileSync(FILE,"utf8").replace(/\r\n/g,"\n"), orig=s;
if(s.includes(MARK)){console.log("[skip] v540 already applied");process.exit(0);}

/* ------------------------------------------------------------
 * Fields: 550ms invisible reconnect grace + one visible recovery pulse.
 * ------------------------------------------------------------ */
const issueField=`  private connectionIssueNotified = false;`;
if(!s.includes(issueField)) throw new Error("connectionIssueNotified field not found. No file written.");
s=s.replace(issueField,`${issueField}

  /*
   * ${MARK}
   * Brief real WebSocket drops are common during network jitter / busy multi-
   * player frames. Give the SAME Room 550ms to recover before surfacing the
   * reconnect UI or freezing local gameplay.
   */
  private connectionIssueGraceTimer?: number;
  private connectionIssueGraceGeneration = 0;
  private connectionIssueGraceUntil = 0;
  private connectionRecoveryNoticeArmed = false;`);

/* ------------------------------------------------------------
 * Transport gate:
 * During the short grace only, SDK reconnecting is treated as temporarily
 * playable locally. This prevents a 1-frame/300ms wobble from freezing movement.
 * Once grace expires the original strict gate applies.
 * ------------------------------------------------------------ */
const stableStart=s.indexOf("  isGameplayTransportStable(): boolean {");
if(stableStart<0) throw new Error("isGameplayTransportStable() not found. No file written.");
const stableEnd=s.indexOf("\n  private ",stableStart+20);
if(stableEnd<0) throw new Error("Could not isolate isGameplayTransportStable(). No file written.");
let stable=s.slice(stableStart,stableEnd);

const oldReconnectTerm=`      !room.reconnection.isReconnecting,`;
if(stable.includes(oldReconnectTerm)){
  stable=stable.replace(oldReconnectTerm,`      (
        !room.reconnection.isReconnecting ||
        Date.now() <
          this.connectionIssueGraceUntil
      ),`);
}else if(!stable.includes("connectionIssueGraceUntil")){
  throw new Error("Current transport reconnect gate differs. No file written.");
}
s=s.slice(0,stableStart)+stable+s.slice(stableEnd);

/* ------------------------------------------------------------
 * Replace notify + clear as one isolated region.
 * ------------------------------------------------------------ */
const notifyStart=s.indexOf("  private notifyConnectionIssue(");
if(notifyStart<0) throw new Error("notifyConnectionIssue() not found. No file written.");
const attachStart=s.indexOf("  private attachRoom(",notifyStart);
if(attachStart<0) throw new Error("attachRoom() boundary not found. No file written.");
const region=s.slice(notifyStart,attachStart);
if(!region.includes("private clearConnectionIssue"))
  throw new Error("clearConnectionIssue() not found beside notify. No file written.");

const replacement=`  private notifyConnectionIssue(
    reason?: string,
  ): void {
    if (
      this.connectionIssueNotified ||
      this.connectionIssueGraceTimer !==
        undefined
    ) {
      return;
    }

    /*
     * ${MARK} / INVISIBLE_GRACE
     *
     * Do not immediately tell GameScene to lock movement/show "reconnecting".
     * Colyseus gets a short chance to recover the same session invisibly.
     */
    const generation =
      ++this.connectionIssueGraceGeneration;

    this.connectionIssueGraceUntil =
      Date.now() +
      550;

    this.connectionIssueGraceTimer =
      globalThis.setTimeout(
        () => {
          if (
            generation !==
              this.connectionIssueGraceGeneration
          ) {
            return;
          }

          this.connectionIssueGraceTimer =
            undefined;

          if (this.connectionIssueNotified) {
            return;
          }

          this.connectionIssueGraceUntil =
            0;
          this.connectionIssueNotified =
            true;
          this.connectionRecoveryNoticeArmed =
            true;

          this.connectionDropHandlers
            .forEach(
              (handler) => {
                handler(reason);
              },
            );
        },
        550,
      );
  }

  private clearConnectionIssue(): void {
    /*
     * ${MARK} / CANCEL_MICRO_DROP
     * Recovery inside the invisible grace produces NO drop UI and NO
     * "reconnected" toast. To the player, gameplay simply continued.
     */
    this.connectionIssueGraceGeneration +=
      1;

    if (
      this.connectionIssueGraceTimer !==
      undefined
    ) {
      globalThis.clearTimeout(
        this.connectionIssueGraceTimer,
      );

      this.connectionIssueGraceTimer =
        undefined;
    }

    this.connectionIssueGraceUntil =
      0;
    this.connectionIssueNotified =
      false;
    this.lastRoomPingAt =
      Date.now();

    if (!this.connectionRecoveryNoticeArmed) {
      return;
    }

    this.connectionRecoveryNoticeArmed =
      false;

    this.connectionRecoveredHandlers
      .forEach(
        (handler) => {
          handler();
        },
      );
  }

`;
s=s.slice(0,notifyStart)+replacement+s.slice(attachStart);

/* ------------------------------------------------------------
 * attachRoom: cancel an OLD pending grace timer when Room ownership changes,
 * but keep an already-armed visible recovery epoch so clearConnectionIssue()
 * can still emit exactly one legitimate recovered callback.
 * ------------------------------------------------------------ */
const attachIdx=s.indexOf("  private attachRoom(");
const attachEnd=s.indexOf("\n  private ",attachIdx+20);
if(attachIdx<0||attachEnd<0) throw new Error("Could not isolate attachRoom(). No file written.");
let attach=s.slice(attachIdx,attachEnd);

const resetAnchor=`    this.connectionIssueNotified =
      false;`;
if(attach.includes(resetAnchor)){
  attach=attach.replace(resetAnchor,`${resetAnchor}

    /*
     * ${MARK} / NEW_ROOM_CANCELS_PENDING_GRACE
     * A newly attached Room invalidates any delayed drop callback belonging
     * to the previous Room. Preserve connectionRecoveryNoticeArmed if the
     * visible issue had already been dispatched.
     */
    this.connectionIssueGraceGeneration +=
      1;

    if (
      this.connectionIssueGraceTimer !==
      undefined
    ) {
      globalThis.clearTimeout(
        this.connectionIssueGraceTimer,
      );

      this.connectionIssueGraceTimer =
        undefined;
    }

    this.connectionIssueGraceUntil =
      0;`);
}else if(!attach.includes("NEW_ROOM_CANCELS_PENDING_GRACE")){
  throw new Error("attachRoom connectionIssue reset anchor not found. No file written.");
}
s=s.slice(0,attachIdx)+attach+s.slice(attachEnd);

/* ------------------------------------------------------------
 * onDrop must still be the real evidence source. We do not alter SDK recovery,
 * retry counts, watchdog, manual reconnect, seat-expiry handoff, or server.
 * ------------------------------------------------------------ */
if(!/room\.onDrop\([\s\S]{0,700}?lastConfirmedTransportDropAt[\s\S]{0,300}?notifyConnectionIssue/.test(s))
  throw new Error("Safety check failed: real room.onDrop -> notify path missing. No file written.");

s=`/* ${MARK}: real drops get 550ms invisible grace; only persistent drops lock gameplay/show reconnect UI; recovered UI is one-shot. */\n`+s;

for(const [label,ok] of [
 ["grace timer",s.includes("connectionIssueGraceTimer")],
 ["550ms grace",/connectionIssueGraceUntil\s*=[\s\S]{0,60}?Date\.now\(\)\s*\+\s*550/.test(s)],
 ["transport grace",/room\.reconnection\.isReconnecting[\s\S]{0,100}?connectionIssueGraceUntil/.test(s)],
 ["visible drop arm",s.includes("connectionRecoveryNoticeArmed =\n            true") || /connectionRecoveryNoticeArmed\s*=\s*true/.test(s)],
 ["micro-drop cancel",s.includes("CANCEL_MICRO_DROP")],
 ["new room cancel",s.includes("NEW_ROOM_CANCELS_PENDING_GRACE")],
]) if(!ok) throw new Error(`Postcondition failed: ${label}. No file written.`);

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","MultiplayerClient-before-v540.ts"),orig,"utf8");
fs.writeFileSync(FILE,s,"utf8");

console.log("Applied v0.10.10.540.");
console.log(" - real onDrop gets a 550ms invisible grace window");
console.log(" - recovery within 550ms: NO reconnect UI, NO recovered toast, NO gameplay lock pulse");
console.log(" - persistent drop >550ms: existing reconnect lock/UI activates normally");
console.log(" - SDK reconnect/manual reconnect/fresh handoff policies are unchanged");
console.log(" - recovered callback is emitted at most once per visible issue");
console.log(" - new Room ownership cancels stale delayed drop callbacks");
console.log(" - server source unchanged");
console.log("Next: npm run build");
