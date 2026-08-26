const fs = require('fs');
const path = require('path');

const candidates = [
  path.join(process.cwd(), 'src', 'network', 'MultiplayerClient.ts'),
  path.join(process.cwd(), 'src', 'game', 'MultiplayerClient.ts'),
  path.join(process.cwd(), 'src', 'MultiplayerClient.ts'),
];

const target = candidates.find((p) => fs.existsSync(p));
if (!target) {
  throw new Error(
    'MultiplayerClient.ts not found. Expected one of:\n' +
    candidates.map((p) => ' - ' + p).join('\n')
  );
}

let src = fs.readFileSync(target, 'utf8');
const original = src;

const marker = 'V1010471_RECOVERY_NOTICE_EPOCH_DEDUPE';
if (src.includes(marker)) {
  console.log('[v0.10.10.471] Already applied:', target);
  process.exit(0);
}

const anchorField = `  private connectionIssueNotified = false;`;
if (!src.includes(anchorField)) {
  throw new Error('Could not find connectionIssueNotified field. No file written.');
}

src = src.replace(
  anchorField,
  `${anchorField}\n\n  /* ${marker}\n   * Transport recovery itself is unchanged. This flag only deduplicates the\n   * public connectionRecovered pulse so one confirmed drop produces one\n   * recovered notification, even if ping/onReconnect/fresh-handoff convergence\n   * call clearConnectionIssue() more than once.\n   */\n  private connectionRecoveryNoticeArmed = false;`
);

const notifyOld = `  private notifyConnectionIssue(\n    reason?: string,\n  ): void {\n    if (this.connectionIssueNotified) {\n      return;\n    }\n\n    this.connectionIssueNotified = true;\nthis.connectionDropHandlers\n      .forEach(\n        (handler) => {\n          handler(reason);\n        },\n      );\n  }`;

const notifyNew = `  private notifyConnectionIssue(\n    reason?: string,\n  ): void {\n    if (this.connectionIssueNotified) {\n      return;\n    }\n\n    this.connectionIssueNotified = true;\n\n    /* ${marker} / ARM_ON_REAL_ISSUE\n     * Arm exactly one recovered pulse for this connection-issue epoch.\n     * Reconnect ownership, watchdog timing and transport recovery are untouched.\n     */\n    this.connectionRecoveryNoticeArmed = true;\n\nthis.connectionDropHandlers\n      .forEach(\n        (handler) => {\n          handler(reason);\n        },\n      );\n  }`;

if (!src.includes(notifyOld)) {
  throw new Error('notifyConnectionIssue() shape differs. No file written.');
}
src = src.replace(notifyOld, notifyNew);

const clearOld = `  private clearConnectionIssue(): void {\n    this.connectionIssueNotified = false;\nthis.lastRoomPingAt = Date.now();\n\n    this.connectionRecoveredHandlers\n      .forEach(\n        (handler) => {\n          handler();\n        },\n      );\n  }`;

const clearNew = `  private clearConnectionIssue(): void {\n    this.connectionIssueNotified = false;\nthis.lastRoomPingAt = Date.now();\n\n    /* ${marker} / ONE_RECOVERED_PULSE\n     * IMPORTANT: do not gate transport recovery itself here. attachRoom(),\n     * SDK reconnect, manual reconnect and fresh clientKey handoff still run\n     * exactly as before. We only suppress duplicate recovered callbacks after\n     * the first successful clear belonging to the same issue epoch.\n     */\n    if (!this.connectionRecoveryNoticeArmed) {\n      return;\n    }\n\n    this.connectionRecoveryNoticeArmed = false;\n\n    this.connectionRecoveredHandlers\n      .forEach(\n        (handler) => {\n          handler();\n        },\n      );\n  }`;

if (!src.includes(clearOld)) {
  throw new Error('clearConnectionIssue() shape differs. No file written.');
}
src = src.replace(clearOld, clearNew);

// Intentionally do NOT reset connectionRecoveryNoticeArmed inside attachRoom().
// Recovery paths replace the Room before clearConnectionIssue(); keeping the arm
// across attachRoom is what preserves one legitimate GameScene recovery pulse.

if (src === original) {
  throw new Error('No changes made. No file written.');
}

fs.writeFileSync(target, src, 'utf8');
console.log('[v0.10.10.471] Applied safely:', target);
console.log(' - reconnect/backoff/watchdog/fresh handoff logic: unchanged');
console.log(' - connectionRecovered callback: max once per connection-issue epoch');
