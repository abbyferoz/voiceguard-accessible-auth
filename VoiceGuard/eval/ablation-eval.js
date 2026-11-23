/*
 * Ablation of the push guard: replays the concurrent-login races, the fatigue
 * schedules, the speech-rate expiry cases and the normal-use cases with each
 * PushGuard component switched off in turn, and reports what is lost.
 *
 *   node eval/ablation-eval.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const PG = require('../public/js/push-guard.js');

const VICTIM = { browser: 'Chrome', os: 'Windows', location: 'Karachi' };
const ATTACKER = { browser: 'Firefox', os: 'Linux', location: 'Lahore' };
const KNOWN = [PG.deviceKey(VICTIM)];
const COMPONENTS = Object.keys(PG.DEFAULT_COMPONENTS);

const CONFIGS = [
  { name: 'Full VoiceGuard', off: [] },
  ...COMPONENTS.map((c) => ({ name: `Without ${c}`, off: [c] })),
  { name: 'Without codeWord and context', off: ['codeWord', 'context'] },
  { name: 'All components off', off: COMPONENTS },
];
const switches = (off) => Object.fromEntries(COMPONENTS.map((c) => [c, !off.includes(c)]));

let n = 0;
const push = (actor, at, device, status) => ({
  id: `p${++n}`, account: 'a', actor, service: 'Northwind Bank', device,
  codeWord: actor === 'victim' ? 'TIGER' : 'MANGO', createdAt: at, status: status || 'pending',
});

// What the listener can use to tell two pushes apart: the announcement minus
// the parts that always differ (position in the list and age).
const comparable = (text) => text
  .replace(/request \d+ of \d+/g, 'request')
  .replace(/started [^.]*\./g, '')
  .replace(/\s+/g, ' ').trim();

const DELAYS = [0, 1, 2.5, 5, 10, 30, 60];
const INTERVALS = [5, 10, 30, 60, 90, 300, 900];
const RATES = [0.75, 1, 1.25, 1.5, 2];

function concurrentFor(comp) {
  const out = {};
  for (const spoof of [false, true]) {
    let distinguishable = 0, alerted = 0, newDevice = 0;
    for (const delayS of DELAYS) {
      const v = push('victim', 1e6, VICTIM);
      const a = push('attacker', 1e6 + delayS * 1000, spoof ? { ...VICTIM } : ATTACKER);
      const all = [v, a];
      const now = a.createdAt;
      const gv = PG.assess(v, all, now, { knownDevices: KNOWN }, comp);
      const ga = PG.assess(a, all, now, { knownDevices: KNOWN }, comp);
      if (comparable(gv.announcement) !== comparable(ga.announcement)) distinguishable++;
      if (ga.warnings.some((w) => w.type === 'concurrent' || w.type === 'new-device')) alerted++;
      if (ga.warnings.some((w) => w.type === 'new-device')) newDevice++;
    }
    out[spoof ? 'spoofed' : 'unspoofed'] = { distinguishable, alerted, newDevice, races: DELAYS.length };
  }
  return out;
}

function fatigueFor(comp) {
  let lockedBy3 = 0, warnedBy3 = 0, total = 0;
  for (const intervalS of INTERVALS.filter((s) => s <= 300)) {
    for (const userDenies of [true, false]) {
      const all = [];
      let warn = null, lock = null;
      for (let i = 0; i < 10; i++) {
        const at = 1e6 + i * intervalS * 1000;
        for (const p of all) if (p.status === 'pending') p.status = userDenies ? 'denied' : 'expired';
        const p = push('attacker', at, ATTACKER);
        all.push(p);
        const g = PG.assess(p, all, at, { knownDevices: KNOWN }, comp);
        if (warn == null && g.warnings.some((w) => w.type === 'fatigue')) warn = i + 1;
        if (lock == null && g.locked) lock = i + 1;
      }
      total++;
      if (warn && warn <= 3) warnedBy3++;
      if (lock && lock <= 3) lockedBy3++;
    }
  }
  return { schedules: total, warnedBy3, lockedBy3 };
}

function expiryFor(comp) {
  return RATES.map((rate) => {
    const v = push('victim', 1e6, VICTIM);
    const a = push('attacker', 1e6 + 2000, { ...VICTIM });
    const g = PG.assess(a, [v, a], a.createdAt, { rate, knownDevices: KNOWN }, comp);
    const listenS = PG.speechSeconds(g.announcement, rate);
    const expiryS = g.expiresMs / 1000;
    return { rate, listenS: +listenS.toFixed(1), expiryS: Math.round(expiryS), hearTwice: expiryS >= 2 * listenS + 30 - 1 };
  });
}

function normalUseFor(comp) {
  const one = push('victim', 1e6, VICTIM);
  const g1 = PG.assess(one, [one], 1e6, { knownDevices: KNOWN }, comp);
  const first = push('victim', 1e6, VICTIM, 'expired');
  const retry = push('victim', 1e6 + 70000, VICTIM);
  const g2 = PG.assess(retry, [first, retry], retry.createdAt, { knownDevices: KNOWN }, comp);
  return { falseAlarms: g1.warnings.length + g2.warnings.length, lockedOnNormalUse: g1.locked || g2.locked };
}

const rows = CONFIGS.map((cfg) => {
  const comp = switches(cfg.off);
  const conc = concurrentFor(comp);
  const fat = fatigueFor(comp);
  const exp = expiryFor(comp);
  const norm = normalUseFor(comp);
  return { config: cfg.name, off: cfg.off, concurrent: conc, fatigue: fat, expiry: exp, normalUse: norm };
});

// ---------- what each component contributes ----------
const full = rows[0];
const lost = (r) => {
  const out = [];
  const c = r.concurrent, fc = full.concurrent;
  if (c.spoofed.distinguishable < fc.spoofed.distinguishable) {
    out.push(`with a spoofed device, the two pushes sound the same in ${c.spoofed.races - c.spoofed.distinguishable} of ${c.spoofed.races} races`);
  }
  if (c.unspoofed.distinguishable < fc.unspoofed.distinguishable) {
    out.push(`even with a different device, the pushes sound the same in ${c.unspoofed.races - c.unspoofed.distinguishable} of ${c.unspoofed.races} races`);
  }
  if (c.spoofed.alerted < fc.spoofed.alerted) {
    out.push(`no warning about the second request in ${c.spoofed.races - c.spoofed.alerted} of ${c.spoofed.races} spoofed races`);
  }
  if (c.unspoofed.newDevice < fc.unspoofed.newDevice) {
    out.push(`no "new device" warning and no spoken device or city, so without a code word an attacker on another device sounds like the user`);
  }
  if (r.fatigue.lockedBy3 < full.fatigue.lockedBy3) {
    out.push(`Approve locked by the 3rd spam push in ${r.fatigue.lockedBy3} of ${r.fatigue.schedules} schedules (full: ${full.fatigue.lockedBy3})`);
  }
  const short = r.expiry.filter((e) => !e.hearTwice);
  if (short.length) {
    out.push(`expiry too short to hear the request twice plus 30 s at rate ${short.map((e) => `${e.rate}× (${e.expiryS} s for ${e.listenS} s of speech)`).join(', ')}`);
  }
  if (r.normalUse.falseAlarms > full.normalUse.falseAlarms) out.push('false alarms on a normal sign-in');
  return out.length ? out : ['nothing measurable in these scenarios'];
};

const summaryFile = path.join(__dirname, 'results', 'summary.json');
const phishing = fs.existsSync(summaryFile) ? JSON.parse(fs.readFileSync(summaryFile, 'utf8')).phishing : null;

const result = {
  generatedAt: new Date().toISOString(),
  scenarios: { delaysS: DELAYS, fatigueIntervalsS: INTERVALS.filter((s) => s <= 300), rates: RATES },
  configs: rows.map((r) => ({ ...r, lost: r === full ? [] : lost(r) })),
  domainWarningOff: phishing ? {
    note: 'With the domain warning off, the listener hears the baseline reading of the domain.',
    audiblyIdentical: phishing.audiblyIdenticalBaseline,
    meanSimilarity: phishing.baselineMeanSimilarity,
    withWarningMeanSimilarity: phishing.guardMeanSimilarity,
  } : null,
};

const outDir = path.join(__dirname, 'results');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'ablation.json'), JSON.stringify(result, null, 2));

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const exp1 = (r) => r.expiry.find((e) => e.rate === 1);
const exp075 = (r) => r.expiry.find((e) => e.rate === 0.75);
const md = [
  '# Push-guard ablation', '',
  'Generated with `node eval/ablation-eval.js`. Each row switches off one component of the push guard and replays',
  `the same scenarios: ${DELAYS.length} concurrent-login races (attacker ${DELAYS.join(', ')} s after the victim), with and without a`,
  `spoofed device; ${result.scenarios.fatigueIntervalsS.length * 2} fatigue schedules (one push every ${result.scenarios.fatigueIntervalsS.join(', ')} s, user denies or ignores);`,
  `expiry at speech rates ${RATES.join(', ')}×; and two normal sign-ins. "Sound different" compares the two spoken announcements`,
  'after removing the request number and age. Keeping every push visible (no override) is part of the VoiceGuard',
  'interface and is not switched off here.', '',
  '| Configuration | Pushes sound different (spoofed device) | Pushes sound different (other device) | Warned of second request (spoofed) | New-device warning (other device) | Approve locked by 3rd spam push | Expiry at 1.0× / 0.75× | False alarms on normal use |',
  '|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.config} | ${r.concurrent.spoofed.distinguishable}/${r.concurrent.spoofed.races} | ${r.concurrent.unspoofed.distinguishable}/${r.concurrent.unspoofed.races} | ${r.concurrent.spoofed.alerted}/${r.concurrent.spoofed.races} | ${r.concurrent.unspoofed.newDevice}/${r.concurrent.unspoofed.races} | ${r.fatigue.lockedBy3}/${r.fatigue.schedules} | ${exp1(r).expiryS} s / ${exp075(r).expiryS} s | ${r.normalUse.falseAlarms} |`),
  '',
  '## What is lost without each component', '',
  ...result.configs.slice(1).map((r) => `- **${r.config}:** ${r.lost.join('; ')}.`),
  '',
  ...(result.domainWarningOff ? [
    '## Domain warning', '',
    `With the look-alike link warning off, the listener hears the baseline reading: ${pct(result.domainWarningOff.audiblyIdentical)} of the 1,114 look-alikes sound identical to the real domain,`,
    `and mean spoken similarity is ${pct(result.domainWarningOff.meanSimilarity)} instead of ${pct(result.domainWarningOff.withWarningMeanSimilarity)} (see phishing_results.md).`, '',
  ] : []),
].join('\n');
fs.writeFileSync(path.join(outDir, 'ablation_results.md'), md);
console.log(md);
