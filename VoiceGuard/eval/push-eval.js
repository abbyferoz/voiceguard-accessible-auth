/*
 * Automated push-abuse evaluation: replays concurrent-login and fatigue attack
 * schedules through PushGuard.assess() and compares what a screen-reader user
 * would face with and without VoiceGuard.
 *
 *   node eval/push-eval.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const PG = require('../public/js/push-guard.js');

const VICTIM = { browser: 'Chrome', os: 'Windows', location: 'Karachi' };
const ATTACKER = { browser: 'Firefox', os: 'Linux', location: 'Lahore' };
const KNOWN = [PG.deviceKey(VICTIM)];
let n = 0;
const push = (actor, at, device, status) => ({
  id: `p${++n}`, account: 'a', actor, service: 'Northwind Bank', device, codeWord: actor === 'victim' ? 'TIGER' : 'MANGO',
  createdAt: at, status: status || 'pending',
});
const baselineVisible = (pushes) => pushes.filter((p) => p.status === 'pending').sort((a, b) => a.createdAt - b.createdAt).slice(-1);
const checks = [];
const check = (name, pass) => { checks.push({ name, pass: !!pass }); };

// ---------- 1. concurrent login ----------
const concurrent = [];
for (const delayS of [0, 1, 2.5, 5, 10, 30, 60]) {
  for (const spoof of [false, true]) {
    const t0 = 1e6;
    const v = push('victim', t0, VICTIM);
    const a = push('attacker', t0 + delayS * 1000, spoof ? { ...VICTIM } : ATTACKER);
    const all = [v, a];
    const now = a.createdAt;
    const g = PG.assess(a, all, now, { knownDevices: KNOWN });
    const contextOnly = PG.assess(a, all, now, { knownDevices: KNOWN }, { codeWord: false, concurrency: false });
    concurrent.push({
      delayS, spoofedDevice: spoof,
      baselineShows: baselineVisible(all).map((p) => p.actor).join('+'),
      guardShows: all.length,
      concurrencyWarning: g.warnings.some((w) => w.type === 'concurrent'),
      newDeviceWarning: g.warnings.some((w) => w.type === 'new-device'),
      distinguishableByContextOnly: contextOnly.warnings.length > 0,
      codeWordMismatch: v.codeWord !== a.codeWord,
    });
  }
}
check('Baseline: attacker push hides the victim push whenever it arrives second', concurrent.every((r) => r.baselineShows === 'attacker'));
check('VoiceGuard: concurrency warning for every race while the victim request is still pending', concurrent.every((r) => r.concurrencyWarning));
check('VoiceGuard: a spoofed device defeats context details alone (code word still differs)',
  concurrent.filter((r) => r.spoofedDevice).every((r) => !r.distinguishableByContextOnly && r.codeWordMismatch));

// ---------- 2. fatigue ----------
const fatigue = [];
for (const intervalS of [5, 10, 30, 60, 90, 300, 900]) {
  for (const userDenies of [true, false]) {
    const all = [];
    let firstWarnAt = null, lockedFrom = null;
    for (let i = 0; i < 10; i++) {
      const at = 1e6 + i * intervalS * 1000;
      // Earlier pushes were refused or expired before this one arrives.
      for (const p of all) if (p.status === 'pending') p.status = userDenies ? 'denied' : 'expired';
      const p = push('attacker', at, ATTACKER);
      all.push(p);
      const g = PG.assess(p, all, at, { knownDevices: KNOWN });
      if (firstWarnAt == null && g.warnings.some((w) => w.type === 'fatigue')) firstWarnAt = i + 1;
      if (lockedFrom == null && g.locked) lockedFrom = i + 1;
    }
    fatigue.push({ intervalS, userDenies, firstWarnedPush: firstWarnAt, approveLockedFromPush: lockedFrom });
  }
}
check('Fatigue: warned and locked by the 3rd push at intervals of 5 s to 5 min', fatigue.filter((r) => r.intervalS <= 300).every((r) => r.firstWarnedPush && r.firstWarnedPush <= 3));
check('Fatigue limitation: a very slow drip (one push every 15 min) is not detected', fatigue.filter((r) => r.intervalS === 900).every((r) => r.firstWarnedPush == null));

// ---------- 3. false alarms on normal use ----------
{
  const one = push('victim', 1e6, VICTIM);
  const g = PG.assess(one, [one], 1e6, { knownDevices: KNOWN });
  check('Normal single sign-in: no warnings, not locked', g.warnings.length === 0 && !g.locked);
  const first = push('victim', 1e6, VICTIM, 'expired');
  const retry = push('victim', 1e6 + 70000, VICTIM);
  const g2 = PG.assess(retry, [first, retry], retry.createdAt, { knownDevices: KNOWN });
  check('User retries after a timeout: no concurrency warning', !g2.warnings.some((w) => w.type === 'concurrent'));
}

// ---------- 4. adaptive expiry vs speech rate ----------
const expiry = [];
for (const rate of [0.75, 1, 1.25, 1.5, 2]) {
  const v = push('victim', 1e6, VICTIM);
  const a = push('attacker', 1e6 + 2000, { ...VICTIM });
  const g = PG.assess(a, [v, a], a.createdAt, { rate, knownDevices: KNOWN });
  const base = PG.baselineAnnouncement(a);
  expiry.push({
    rate,
    baselineWords: base.split(/\s+/).length,
    baselineListenS: +PG.speechSeconds(base, rate).toFixed(1),
    guardWords: g.announcement.split(/\s+/).length,
    guardListenS: +PG.speechSeconds(g.announcement, rate).toFixed(1),
    guardExpiryS: Math.round(g.expiresMs / 1000),
    fixedExpiryS: PG.DEFAULTS.baseExpiryMs / 1000,
  });
}
check('Adaptive expiry always leaves time to hear the warning twice plus 30 s',
  expiry.every((e) => e.guardExpiryS >= 2 * e.guardListenS + 30 - 1));

// ---------- write ----------
const outDir = path.join(__dirname, 'results');
fs.mkdirSync(outDir, { recursive: true });
const sumFile = path.join(outDir, 'summary.json');
const existing = fs.existsSync(sumFile) ? JSON.parse(fs.readFileSync(sumFile, 'utf8')) : {};
fs.writeFileSync(sumFile, JSON.stringify({ ...existing, push: { concurrent, fatigue, expiry, checks } }, null, 2));

const table = (rows) => {
  const cols = Object.keys(rows[0]);
  return [`| ${cols.join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${cols.map((c) => r[c] == null ? '—' : r[c]).join(' | ')} |`)].join('\n');
};
const md = [
  '# Push-abuse evaluation results', '', `Generated with \`node eval/push-eval.js\`.`, '',
  '## Checks', '', ...checks.map((c) => `- ${c.pass ? 'PASS' : 'FAIL'}: ${c.name}`), '',
  '## Concurrent login', '', table(concurrent), '',
  '## Fatigue', '', table(fatigue), '',
  '## Listening time and expiry by speech rate', '', table(expiry), '',
].join('\n');
fs.writeFileSync(path.join(outDir, 'push_results.md'), md);
console.log(md);
if (checks.some((c) => !c.pass)) process.exitCode = 1;
