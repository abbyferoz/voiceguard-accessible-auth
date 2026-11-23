/*
 * Analysis of the exploratory user study. Reads the study data folder (never
 * writes to it) and summarises Baseline against VoiceGuard.
 *
 *   node eval/study-analysis.js [dataFolder] [--out file.md]
 *
 * dataFolder defaults to data/study and may hold either the files server.js
 * writes (results.jsonl, questionnaires.jsonl) or the CSVs exported from the
 * Experimenter page (results.csv, questionnaires.csv).
 *
 * Excluded: participant P00 (dry run) and any task row whose notes contain
 * "EXCLUDE". When a task was redone, the last remaining attempt is used.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outFile = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : path.join(__dirname, 'results', 'study_results.md');
const positional = args.filter((a, i) => a !== '--out' && i !== outIdx + 1);
const dataDir = positional[0] ? path.resolve(positional[0]) : path.join(__dirname, '..', 'data', 'study');

// ---------- loading ----------
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c !== ''));
  if (!head) return [];
  const value = (s) => {
    if (s === '') return null;
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if (/^[[{]/.test(s)) { try { return JSON.parse(s); } catch (e) { return s; } }
    return s;
  };
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, value(r[i] == null ? '' : r[i])])));
}

function load(name) {
  const jsonl = path.join(dataDir, `${name}.jsonl`);
  const csv = path.join(dataDir, `${name}.csv`);
  if (fs.existsSync(jsonl)) {
    return fs.readFileSync(jsonl, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  }
  if (fs.existsSync(csv)) return parseCsv(fs.readFileSync(csv, 'utf8'));
  return [];
}

if (!fs.existsSync(dataDir)) {
  console.error(`No data folder at ${dataDir}`);
  process.exit(1);
}

const excludedParticipant = (p) => !p || String(p).toUpperCase() === 'P00';
const rawResults = load('results');
const rawQs = load('questionnaires');
const excludedRows = rawResults.filter((r) => excludedParticipant(r.participant) || /EXCLUDE/i.test(r.notes || ''));
const kept = rawResults.filter((r) => !excludedRows.includes(r));

// Last attempt per participant, condition and task.
const lastAttempt = new Map();
for (const r of kept.slice().sort((a, b) => (a.endedAt || 0) - (b.endedAt || 0))) {
  lastAttempt.set(`${r.participant}|${r.condition}|${r.task}`, r);
}
const results = [...lastAttempt.values()];
const lastQ = new Map();
for (const q of rawQs.filter((x) => !excludedParticipant(x.participant)).sort((a, b) => (a.t || 0) - (b.t || 0))) {
  lastQ.set(`${q.participant}|${q.condition}`, q);
}
const qs = [...lastQ.values()];

// ---------- helpers ----------
const CONDS = ['baseline', 'guard'];
const LABEL = { baseline: 'Baseline', guard: 'VoiceGuard' };
const ATTACKS = ['phishing', 'concurrent', 'fatigue'];
const participants = [...new Set(results.map((r) => r.participant))].sort();
const isSuccess = (r) => r.outcome === 'attack_success';
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const median = (a) => {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const nums = (a) => a.filter((x) => typeof x === 'number' && Number.isFinite(x));
const sec = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)} s`);
const fix = (x, d = 1) => (x == null ? '—' : x.toFixed(d));

function choose(n, k) { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; }
// Exact (binomial) McNemar test, two-sided.
function mcnemarExact(b, c) {
  const n = b + c;
  if (n === 0) return 1;
  let tail = 0;
  for (let k = 0; k <= Math.min(b, c); k++) tail += choose(n, k);
  return Math.min(1, (2 * tail) / 2 ** n);
}

const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

// ---------- order ----------
const orderRows = participants.map((p) => {
  const b1 = results.find((r) => r.participant === p && Number(r.block) === 1);
  const first = b1 ? b1.condition : null;
  const tasks = results.filter((r) => r.participant === p).length;
  return [p, first ? `${LABEL[first]} first` : '—', tasks];
});

// ---------- attack success ----------
const attackRows = ATTACKS.map((type) => {
  const cells = CONDS.map((c) => {
    const a = results.filter((r) => r.attack === type && r.condition === c);
    return a.length ? `${a.filter(isSuccess).length}/${a.length}` : '—';
  });
  return [type, ...cells];
});
{
  const cells = CONDS.map((c) => {
    const a = results.filter((r) => ATTACKS.includes(r.attack) && r.condition === c);
    return a.length ? `${a.filter(isSuccess).length}/${a.length}` : '—';
  });
  attackRows.push(['**all attacks**', ...cells]);
}

// ---------- paired McNemar ----------
function pairs(filter) {
  const out = [];
  for (const p of participants) {
    const tasks = [...new Set(results.filter((r) => r.participant === p && filter(r)).map((r) => r.task))];
    for (const t of tasks) {
      const b = results.find((r) => r.participant === p && r.task === t && r.condition === 'baseline');
      const g = results.find((r) => r.participant === p && r.task === t && r.condition === 'guard');
      if (b && g) out.push({ participant: p, task: t, baseline: isSuccess(b), guard: isSuccess(g) });
    }
  }
  return out;
}
const mcnemarRow = (label, pr) => {
  const both = pr.filter((x) => x.baseline && x.guard).length;
  const onlyB = pr.filter((x) => x.baseline && !x.guard).length;
  const onlyG = pr.filter((x) => !x.baseline && x.guard).length;
  const neither = pr.filter((x) => !x.baseline && !x.guard).length;
  return [label, pr.length, onlyB, onlyG, both, neither, pr.length ? mcnemarExact(onlyB, onlyG).toFixed(3) : '—'];
};
const mcRows = [
  ...ATTACKS.map((type) => mcnemarRow(type, pairs((r) => r.attack === type))),
  mcnemarRow('**all attacks**', pairs((r) => ATTACKS.includes(r.attack))),
];
const perParticipant = participants.map((p) => {
  const cell = (c) => {
    const a = results.filter((r) => r.participant === p && r.condition === c && ATTACKS.includes(r.attack));
    return a.length ? `${a.filter(isSuccess).length}/${a.length}` : '—';
  };
  return [p, cell('baseline'), cell('guard')];
});

// ---------- decision time ----------
const decisionRows = ATTACKS.map((type) => [type, ...CONDS.map((c) => sec(median(nums(results.filter((r) => r.attack === type && r.condition === c).map((r) => r.decisionMs)))))]);

// ---------- legitimate sign-in ----------
const legit = (c) => results.filter((r) => r.kind === 'legit' && r.condition === c);
const legitRows = [
  ['Sign-in success', ...CONDS.map((c) => { const a = legit(c); return a.length ? `${a.filter((r) => r.outcome === 'legit_success').length}/${a.length}` : '—'; })],
  ['Median time to sign in', ...CONDS.map((c) => sec(median(nums(legit(c).map((r) => r.timeToSignInMs)))))],
];

// ---------- questionnaires ----------
const qCond = (c) => qs.filter((q) => q.condition === c);
const qRows = [
  ['SUS (0–100, higher is better)', ...CONDS.map((c) => fix(mean(nums(qCond(c).map((q) => q.susScore)))))],
  ['NASA-TLX raw (0–100, lower is better)', ...CONDS.map((c) => fix(mean(nums(qCond(c).map((q) => q.tlxRaw)))))],
  ['Trust (1–7, higher is better)', ...CONDS.map((c) => fix(mean(nums(qCond(c).map((q) => q.trust))), 2))],
  ['Questionnaires (n)', ...CONDS.map((c) => String(qCond(c).length))],
];
const qPerParticipant = participants.map((p) => {
  const get = (c) => qs.find((q) => q.participant === p && q.condition === c) || {};
  const b = get('baseline'), g = get('guard');
  return [p, fix(b.susScore), fix(g.susScore), fix(b.tlxRaw), fix(g.tlxRaw), b.trust ?? '—', g.trust ?? '—'];
});

// ---------- reporting ----------
const reportedRows = ATTACKS.map((type) => [type, ...CONDS.map((c) => {
  const a = results.filter((r) => r.attack === type && r.condition === c);
  return a.length ? `${a.filter((r) => r.reported === true || r.reported === 'true').length}/${a.length}` : '—';
})]);

// ---------- fatigue detail ----------
const fatigueRows = results.filter((r) => r.attack === 'fatigue').map((r) => [r.participant, LABEL[r.condition] || r.condition, r.outcome, r.pushesSent ?? '—', r.pushesBeforeApproval ?? '—', r.detail || '—']);

// ---------- comments ----------
const comments = qs.filter((q) => q.comments).map((q) => `- **${q.participant}, ${LABEL[q.condition] || q.condition}:** ${String(q.comments).replace(/\s+/g, ' ')}`);
const notes = results.filter((r) => r.notes && r.notes !== 'reset').map((r) => `- ${r.participant}, ${LABEL[r.condition] || r.condition}, ${r.task}: ${String(r.notes).replace(/\s+/g, ' ')}`);

const md = [
  '# Exploratory user study results', '',
  `Generated ${new Date().toISOString()} with \`node eval/study-analysis.js\` from \`${(() => { const rel = path.relative(path.join(__dirname, '..'), dataDir); return rel && !rel.startsWith('..') ? rel : dataDir; })()}\`.`, '',
  `**Participants:** ${participants.length} (${participants.join(', ') || 'none'}). **Task rows used:** ${results.length}` +
    ` (from ${rawResults.length} recorded; ${excludedRows.length} excluded as P00 or marked EXCLUDE; redone tasks use the last attempt).`, '',
  '> Exploratory: with this sample the study is not statistically powered. p-values are reported for completeness only,',
  '> and the paired tests treat each participant × task as one pair (two phishing tasks per participant are not independent).', '',
  '## Participants and order', '', table(['Participant', 'Order', 'Tasks scored'], orderRows), '',
  '## Attack success (attacks that succeeded / attempts)', '', table(['Attack', 'Baseline', 'VoiceGuard'], attackRows), '',
  '## Paired outcomes and exact McNemar test (exploratory)', '',
  'Each pair is the same participant doing the same task in both conditions.', '',
  table(['Attack', 'Pairs', 'Fooled only in Baseline', 'Fooled only with VoiceGuard', 'Fooled in both', 'Fooled in neither', 'Exact McNemar p'], mcRows), '',
  table(['Participant', 'Attacks succeeded, Baseline', 'Attacks succeeded, VoiceGuard'], perParticipant), '',
  '## Median decision time', '',
  'Phishing: from opening the email to the first action. Push attacks: from the push arriving to the first decision.', '',
  table(['Attack', 'Baseline', 'VoiceGuard'], decisionRows), '',
  '## Legitimate sign-in (usability cost)', '', table(['Measure', 'Baseline', 'VoiceGuard'], legitRows), '',
  '## Questionnaires (mean per condition)', '', table(['Measure', 'Baseline', 'VoiceGuard'], qRows), '',
  table(['Participant', 'SUS Baseline', 'SUS VoiceGuard', 'TLX Baseline', 'TLX VoiceGuard', 'Trust Baseline', 'Trust VoiceGuard'], qPerParticipant), '',
  '## Attacks reported by the participant', '', table(['Attack', 'Baseline', 'VoiceGuard'], reportedRows), '',
  ...(fatigueRows.length ? ['## Fatigue task detail', '', table(['Participant', 'Condition', 'Outcome', 'Spam pushes sent', 'Pushes before approval', 'Detail'], fatigueRows), ''] : []),
  ...(comments.length ? ['## Questionnaire comments', '', ...comments, ''] : []),
  ...(notes.length ? ['## Observer notes', '', ...notes, ''] : []),
].join('\n');

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, md);
console.log(md);
console.error(`\nWritten to ${outFile}`);
