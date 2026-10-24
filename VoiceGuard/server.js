/*
 * VoiceGuard study server — zero dependencies (Node 18+).
 *
 *   node server.js            → http://localhost:3000
 *
 * Holds the shared state of one simulated victim account (inbox, push
 * requests, sign-in sessions), drives the scripted attacks, records every
 * event of a study session, and streams updates to the PC, phone, attacker
 * and experimenter pages over Server-Sent Events.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const DomainGuard = require('./public/js/domain-guard.js');
const PushGuard = require('./public/js/push-guard.js');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DATA = path.join(__dirname, 'data');
fs.mkdirSync(DATA, { recursive: true });

// ---------------------------------------------------------------------------
// Study material
// ---------------------------------------------------------------------------
const ACCOUNT = 'student@campusmail.edu';
const VICTIM_DEVICE = { browser: 'Chrome', os: 'Windows', location: 'Karachi' };
const ATTACKER_DEVICE = { browser: 'Firefox', os: 'Linux', location: 'Lahore' };

// Fictional brands only. Set A and set B are used in different blocks so a
// participant never sees the same stimuli in both conditions.
const BRAND_SETS = {
  A: { bank: { name: 'Northwind Bank', domain: 'northwindbank.com' }, pay: { name: 'Contoso Pay', domain: 'contosopay.com' } },
  B: { bank: { name: 'Fabrikam Bank', domain: 'fabrikambank.com' }, pay: { name: 'Tailspin Pay', domain: 'tailspinpay.com' } },
};
const MAIL_DOMAIN = 'campusmail.edu';
const TRUSTED = [
  MAIL_DOMAIN,
  ...Object.values(BRAND_SETS).flatMap((s) => [s.bank.domain, s.pay.domain]),
  'google.com', 'microsoft.com', 'apple.com', 'paypal.com', 'amazon.com', 'facebook.com',
];
const CODE_WORDS = ['TIGER', 'MANGO', 'RIVER', 'PIANO', 'CAMEL', 'LEMON', 'ROCKET', 'GARDEN',
  'SILVER', 'PEPPER', 'OCEAN', 'FALCON', 'CANDLE', 'MARBLE', 'BRIDGE', 'COFFEE'];

const TASKS = [
  { id: 'legit_email', kind: 'legit', attack: null,
    instruction: 'You have a new email from your bank about your monthly statement. Open it and sign in to see the statement.' },
  { id: 'phish_typo', kind: 'attack', attack: 'phishing',
    instruction: 'Your bank has emailed you about a security check on your account. Deal with it the way you normally would.' },
  { id: 'legit_login', kind: 'legit', attack: null,
    instruction: 'Sign in to your payment app using the bookmark on the start page.' },
  { id: 'concurrent', kind: 'attack', attack: 'concurrent',
    instruction: 'Sign in to your bank using the bookmark on the start page.' },
  { id: 'fatigue', kind: 'attack', attack: 'fatigue',
    instruction: 'Take a short break and do not sign in to anything. If your phone asks you something, respond the way you normally would.' },
  { id: 'phish_subdomain', kind: 'attack', attack: 'phishing',
    instruction: 'Your payment app has emailed you about a refund. Deal with it the way you normally would.' },
];

const BACKGROUND_MAIL = [
  { from: 'library@campusmail.edu', subject: 'Your borrowed book is due Friday',
    body: 'Reminder: "Interaction Design" is due back on Friday. You can renew it online.',
    link: 'https://library.campusmail.edu/renew', linkText: 'Renew your book' },
  { from: 'events@campusmail.edu', subject: 'HCI seminar this Thursday',
    body: 'Join the accessibility seminar in room 4 at 3 pm. Everyone is welcome.', link: null },
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let seq = 1;
const nextId = (p) => `${p}${seq++}`;

const state = {
  config: {
    condition: 'guard', // 'baseline' | 'guard'
    components: { domain: true, pageAnnounce: true, interstitial: true, ...PushGuard.DEFAULT_COMPONENTS },
    speechRate: 1,
    participant: 'P00',
    block: 1,
    brandSet: 'A',
  },
  inbox: [],
  pushes: [],
  sessions: [],
  task: null,
  attack: { concurrent: null, fatigue: null },
};
let fatigueTimer = null;

function guardOn(component) {
  return state.config.condition === 'guard' && state.config.components[component] !== false;
}
function pushComponents() {
  const c = {};
  for (const k of Object.keys(PushGuard.DEFAULT_COMPONENTS)) c[k] = guardOn(k);
  return c;
}
function brands() { return BRAND_SETS[state.config.brandSet] || BRAND_SETS.A; }

function publicState() {
  return {
    ...state,
    attack: { concurrent: state.attack.concurrent, fatigue: state.attack.fatigue && { ...state.attack.fatigue } },
    trusted: TRUSTED, brandSets: BRAND_SETS, brands: brands(), account: ACCOUNT,
    victimDevice: VICTIM_DEVICE, tasks: TASKS, now: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Persistence and logging
// ---------------------------------------------------------------------------
function append(file, obj) { fs.appendFileSync(path.join(DATA, file), JSON.stringify(obj) + '\n'); }
function readJsonl(file) {
  const f = path.join(DATA, file);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

const recentEvents = [];
function logEvent(type, data) {
  const ev = {
    t: Date.now(), type,
    participant: state.config.participant, condition: state.config.condition,
    block: state.config.block, taskId: state.task ? state.task.id : null,
    taskRun: state.task ? state.task.run : null, ...data,
  };
  append('events.jsonl', ev);
  recentEvents.push(ev);
  if (recentEvents.length > 300) recentEvents.shift();
  broadcast({ kind: 'event', event: ev });
  return ev;
}

// ---------------------------------------------------------------------------
// Server-Sent Events
// ---------------------------------------------------------------------------
const clients = new Set();
function broadcast(msg) {
  const line = `data: ${JSON.stringify(msg)}\n\n`;
  for (const res of clients) res.write(line);
}
function changed() { broadcast({ kind: 'state', state: publicState() }); }

// ---------------------------------------------------------------------------
// Authentication simulation
// ---------------------------------------------------------------------------
function createLogin({ actor, service, domain, device, source }) {
  const now = Date.now();
  const codeWord = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
  const session = { id: nextId('s'), actor, service, domain, device, codeWord, status: 'pending', createdAt: now };
  const push = {
    id: nextId('p'), account: ACCOUNT, sessionId: session.id, actor, service, domain, device,
    codeWord, createdAt: now, status: 'pending', source: source || null,
  };
  state.sessions.push(session);
  state.pushes.push(push);
  const a = PushGuard.assess(push, state.pushes, now,
    { rate: state.config.speechRate, knownDevices: [PushGuard.deviceKey(VICTIM_DEVICE)] }, pushComponents());
  push.expiresAt = now + a.expiresMs;
  session.pushId = push.id;
  logEvent('push_created', { pushId: push.id, actor, source: push.source, service, expiresMs: a.expiresMs,
    warnings: state.config.condition === 'guard' ? a.warnings.map((w) => w.type) : [] });

  if (actor === 'victim' && state.attack.concurrent) {
    const { delayMs, spoofSame } = state.attack.concurrent;
    state.attack.concurrent = null;
    setTimeout(() => {
      createLogin({ actor: 'attacker', service, domain, device: spoofSame ? { ...VICTIM_DEVICE } : ATTACKER_DEVICE, source: 'concurrent' });
    }, delayMs);
  }
  changed();
  return { session, push };
}

function decide(pushId, decision) {
  const push = state.pushes.find((p) => p.id === pushId);
  if (!push) return { error: 'no such push' };
  if (push.status !== 'pending') return { error: `push already ${push.status}` };
  if (decision === 'approve' && state.config.condition === 'guard') {
    const a = PushGuard.assess(push, state.pushes, Date.now(), {}, pushComponents());
    if (a.locked) return { error: 'approval locked by fatigue protection' };
  }
  const status = { approve: 'approved', deny: 'denied', report: 'reported' }[decision];
  if (!status) return { error: 'bad decision' };
  push.status = status;
  push.decidedAt = Date.now();
  const session = state.sessions.find((s) => s.id === push.sessionId);
  if (session) session.status = status === 'approved' ? 'approved' : 'denied';
  logEvent('push_decision', { pushId, decision, actor: push.actor, source: push.source,
    decisionMs: push.decidedAt - push.createdAt });
  if (push.actor === 'attacker' && status === 'approved') {
    logEvent('attack_success', { attack: push.source, pushId });
    stopFatigue();
  }
  changed();
  return { push };
}

setInterval(() => {
  const now = Date.now();
  let any = false;
  for (const p of state.pushes) {
    if (p.status === 'pending' && p.expiresAt <= now) {
      p.status = 'expired';
      const s = state.sessions.find((x) => x.id === p.sessionId);
      if (s) s.status = 'expired';
      logEvent('push_expired', { pushId: p.id, actor: p.actor, source: p.source });
      any = true;
    }
  }
  if (any) changed();
}, 1000);

function startFatigue({ count = 6, intervalMs = 10000, service, domain, spoofSame = false }) {
  stopFatigue();
  const b = brands().bank;
  const f = { count, intervalMs, sent: 0, service: service || b.name, domain: domain || b.domain };
  state.attack.fatigue = f;
  const fire = () => {
    if (!state.attack.fatigue) return;
    createLogin({ actor: 'attacker', service: f.service, domain: f.domain,
      device: spoofSame ? { ...VICTIM_DEVICE } : ATTACKER_DEVICE, source: 'fatigue' });
    f.sent++;
    if (f.sent >= f.count) stopFatigue();
  };
  fire();
  fatigueTimer = setInterval(fire, intervalMs);
  logEvent('attack_started', { attack: 'fatigue', count, intervalMs });
  changed();
}
function stopFatigue() {
  if (fatigueTimer) clearInterval(fatigueTimer);
  fatigueTimer = null;
  if (state.attack.fatigue) { state.attack.fatigue = null; changed(); }
}

function addEmail(e) {
  const email = { id: nextId('m'), receivedAt: Date.now(), read: false, ...e };
  state.inbox.unshift(email);
  changed();
  return email;
}

function phishingEmail(task, set) {
  const b = BRAND_SETS[set];
  if (task.id === 'phish_typo') {
    const fake = DomainGuard.makeLookalike(b.bank.domain, 'repetition', 11);
    return { from: `security@${fake}`, subject: `${b.bank.name}: unusual sign-in detected`, kind: 'phish', attack: 'repetition',
      body: `We noticed an unusual sign-in to your ${b.bank.name} account. Please confirm your identity within 24 hours to avoid suspension.`,
      link: `https://${fake}/verify`, linkText: 'Confirm your identity' };
  }
  const fake = DomainGuard.makeLookalike(b.pay.domain, 'brand-in-subdomain', 5);
  return { from: `refunds@${fake.split('.').slice(-2).join('.')}`, subject: `${b.pay.name}: you have a refund of Rs 4,500`, kind: 'phish',
    attack: 'brand-in-subdomain',
    body: `A refund of Rs 4,500 is waiting for you. Sign in to ${b.pay.name} to claim it before it expires.`,
    link: `https://${fake}/refund`, linkText: 'Claim your refund' };
}

// ---------------------------------------------------------------------------
// Study tasks
// ---------------------------------------------------------------------------
function resetWorld() {
  stopFatigue();
  state.attack.concurrent = null;
  state.pushes = [];
  state.sessions = [];
  state.inbox = BACKGROUND_MAIL.map((m, i) => ({ id: nextId('m'), receivedAt: Date.now() - (i + 1) * 3600e3, read: true, kind: 'legit', ...m }));
}

function startTask(taskId) {
  const task = TASKS.find((t) => t.id === taskId);
  if (!task) return { error: 'unknown task' };
  if (state.task) endTask('superseded');
  resetWorld();
  const set = state.config.brandSet;
  const b = BRAND_SETS[set];
  state.task = { ...task, run: nextId('run'), startedAt: Date.now(), set };
  broadcast({ kind: 'command', command: 'reset-pc' });
  logEvent('task_started', { instruction: task.instruction, set });

  if (task.id === 'legit_email') {
    addEmail({ from: `statements@${b.bank.domain}`, subject: `Your ${b.bank.name} statement is ready`, kind: 'legit',
      body: `Your monthly statement for October is ready. Sign in to ${b.bank.name} to view it.`,
      link: `https://${b.bank.domain}/statements`, linkText: 'View your statement' });
  } else if (task.attack === 'phishing') {
    addEmail(phishingEmail(task, set));
  } else if (task.id === 'concurrent') {
    state.attack.concurrent = { delayMs: 2500, spoofSame: true };
  } else if (task.id === 'fatigue') {
    setTimeout(() => { if (state.task && state.task.id === 'fatigue') startFatigue({ count: 6, intervalMs: 10000 }); }, 5000);
  }
  changed();
  return { task: state.task };
}

function scoreTask(task, events, pushes) {
  const ev = (type, pred) => events.filter((e) => e.type === type && (!pred || pred(e)));
  const first = (arr) => (arr.length ? arr[0] : null);
  const row = {
    participant: state.config.participant, condition: state.config.condition, block: state.config.block,
    set: task.set, task: task.id, kind: task.kind, attack: task.attack, startedAt: task.startedAt,
    endedAt: Date.now(), durationMs: Date.now() - task.startedAt,
    warningsHeard: ev('guard_warning').length, reported: false, outcome: '', detail: '', decisionMs: null,
  };
  const victimApproved = pushes.find((p) => p.actor === 'victim' && p.status === 'approved');
  const attackerApproved = pushes.find((p) => p.actor === 'attacker' && p.status === 'approved');
  row.reported = ev('mail_reported').length > 0 || pushes.some((p) => p.status === 'reported');

  if (task.attack === 'phishing') {
    const opened = first(ev('phish_page_opened'));
    const submitted = first(ev('phish_credentials_submitted'));
    const mailOpened = first(ev('mail_opened', (e) => e.kind === 'phish'));
    const firstAction = first(events.filter((e) => ['phish_link_activated', 'interstitial_back', 'mail_reported',
      'mail_deleted', 'phish_credentials_submitted'].includes(e.type)));
    row.outcome = submitted ? 'attack_success' : 'resisted';
    row.detail = [ev('interstitial_back').length && 'went_back_from_warning', opened && 'opened_link', submitted && 'submitted_credentials',
      attackerApproved && 'approved_relay_push', row.reported && 'reported'].filter(Boolean).join(';') || 'ignored';
    if (mailOpened && firstAction) row.decisionMs = firstAction.t - mailOpened.t;
  } else if (task.attack === 'concurrent' || task.attack === 'fatigue') {
    const attackerPushes = pushes.filter((p) => p.actor === 'attacker');
    row.outcome = attackerApproved ? 'attack_success' : 'resisted';
    row.pushesSent = attackerPushes.length;
    if (attackerApproved) row.pushesBeforeApproval = attackerPushes.filter((p) => p.createdAt <= attackerApproved.createdAt).length;
    row.detail = [victimApproved && 'approved_own', attackerApproved && 'approved_attacker', row.reported && 'reported']
      .filter(Boolean).join(';') || 'no_approval';
    const decided = pushes.filter((p) => p.decidedAt).sort((a, b) => a.decidedAt - b.decidedAt)[0];
    if (decided) row.decisionMs = decided.decidedAt - decided.createdAt;
  } else {
    row.outcome = victimApproved ? 'legit_success' : 'legit_fail';
    row.detail = victimApproved ? 'signed_in' : (ev('phish_page_opened').length ? 'wrong_site' : 'not_signed_in');
    if (victimApproved) row.decisionMs = victimApproved.decidedAt - victimApproved.createdAt;
    row.timeToSignInMs = victimApproved ? victimApproved.decidedAt - task.startedAt : null;
  }
  return row;
}

function endTask(notes) {
  const task = state.task;
  if (!task) return { error: 'no task running' };
  stopFatigue();
  state.attack.concurrent = null;
  const events = readJsonl('events.jsonl').filter((e) => e.taskRun === task.run);
  const row = scoreTask(task, events, state.pushes);
  row.notes = typeof notes === 'string' ? notes : '';
  append('results.jsonl', row);
  logEvent('task_ended', { outcome: row.outcome, detail: row.detail });
  state.task = null;
  changed();
  return { result: row };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
function susScore(items) {
  if (!Array.isArray(items) || items.length !== 10 || items.some((x) => !(x >= 1 && x <= 5))) return null;
  return items.reduce((s, x, i) => s + (i % 2 === 0 ? x - 1 : 5 - x), 0) * 2.5;
}

function summarize() {
  const rows = readJsonl('results.jsonl');
  const qs = readJsonl('questionnaires.jsonl');
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const byCondition = {};
  for (const cond of ['baseline', 'guard']) {
    const r = rows.filter((x) => x.condition === cond);
    const attack = {};
    for (const type of ['phishing', 'concurrent', 'fatigue']) {
      const a = r.filter((x) => x.attack === type);
      attack[type] = { n: a.length, successes: a.filter((x) => x.outcome === 'attack_success').length,
        rate: a.length ? a.filter((x) => x.outcome === 'attack_success').length / a.length : null,
        meanDecisionMs: mean(a.map((x) => x.decisionMs).filter((x) => x != null)) };
    }
    const legit = r.filter((x) => x.kind === 'legit');
    const q = qs.filter((x) => x.condition === cond);
    byCondition[cond] = {
      participants: [...new Set(r.map((x) => x.participant))].length,
      attack,
      legit: { n: legit.length, successRate: legit.length ? legit.filter((x) => x.outcome === 'legit_success').length / legit.length : null,
        meanTimeToSignInMs: mean(legit.map((x) => x.timeToSignInMs).filter((x) => x != null)) },
      sus: mean(q.map((x) => x.susScore).filter((x) => x != null)),
      tlx: mean(q.map((x) => x.tlxRaw).filter((x) => x != null)),
    };
  }
  return { rows, questionnaires: qs, byCondition };
}

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json', 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); } });
  });
}

const routes = {
  'GET /api/state': () => publicState(),
  'GET /api/events': () => recentEvents.slice(-150),
  'POST /api/config': (b) => {
    const c = state.config;
    if (['baseline', 'guard'].includes(b.condition)) c.condition = b.condition;
    if (b.components && typeof b.components === 'object') {
      for (const k of Object.keys(c.components)) if (typeof b.components[k] === 'boolean') c.components[k] = b.components[k];
    }
    if (b.speechRate >= 0.5 && b.speechRate <= 3) c.speechRate = Number(b.speechRate);
    if (typeof b.participant === 'string' && b.participant.trim()) c.participant = b.participant.trim().slice(0, 20);
    if ([1, 2].includes(b.block)) c.block = b.block;
    if (BRAND_SETS[b.brandSet]) c.brandSet = b.brandSet;
    logEvent('config_changed', { config: { ...c } });
    changed();
    return { config: c };
  },
  'POST /api/login': (b) => {
    const actor = b.actor === 'attacker' ? 'attacker' : 'victim';
    const device = actor === 'victim' ? VICTIM_DEVICE : (b.spoofSame ? { ...VICTIM_DEVICE } : ATTACKER_DEVICE);
    return createLogin({ actor, service: String(b.service || brands().bank.name), domain: String(b.domain || brands().bank.domain),
      device, source: b.source || (actor === 'attacker' ? 'manual' : null) });
  },
  'POST /api/email': (b) => {
    if (b.attack) {
      const target = String(b.target || brands().bank.domain);
      const fake = DomainGuard.makeLookalike(target, b.attack, Number(b.seed) || Date.now() % 1000);
      if (!fake) return { error: `cannot build a ${b.attack} look-alike of ${target}` };
      const name = Object.values(BRAND_SETS).flatMap((s) => [s.bank, s.pay]).find((x) => x.domain === target);
      const brand = name ? name.name : target;
      const email = addEmail({ from: `security@${fake.split('.').slice(-2).join('.')}`, kind: 'phish', attack: b.attack,
        subject: b.subject || `${brand}: please verify your account`,
        body: b.body || `We could not verify your recent activity. Sign in to ${brand} within 24 hours to keep your account active.`,
        link: `https://${fake}/verify`, linkText: b.linkText || 'Verify your account' });
      logEvent('attack_started', { attack: 'phishing', variant: b.attack, link: email.link });
      return { email };
    }
    return { email: addEmail({ kind: 'legit', ...b }) };
  },
  'POST /api/mail/read': (b) => { const m = state.inbox.find((x) => x.id === b.id); if (m) { m.read = true; changed(); } return {}; },
  'POST /api/mail/delete': (b) => { state.inbox = state.inbox.filter((x) => x.id !== b.id); changed(); return {}; },
  'POST /api/attack/concurrent': (b) => {
    state.attack.concurrent = { delayMs: Math.max(0, Number(b.delayMs) || 2500), spoofSame: !!b.spoofSame };
    logEvent('attack_armed', { attack: 'concurrent', ...state.attack.concurrent });
    changed();
    return { armed: state.attack.concurrent };
  },
  'POST /api/attack/fatigue': (b) => {
    startFatigue({ count: Math.min(30, Number(b.count) || 6), intervalMs: Math.max(1000, Number(b.intervalMs) || 10000),
      spoofSame: !!b.spoofSame });
    return { fatigue: state.attack.fatigue };
  },
  'POST /api/attack/stop': () => { stopFatigue(); state.attack.concurrent = null; changed(); logEvent('attack_stopped', {}); return {}; },
  'POST /api/log': (b) => {
    const { type, ...rest } = b;
    if (!type) return { error: 'type required' };
    const ev = logEvent(String(type).slice(0, 60), rest);
    if (type === 'phish_credentials_submitted' && rest.target) {
      const brand = Object.values(BRAND_SETS).flatMap((s) => [s.bank, s.pay]).find((x) => x.domain === rest.target);
      setTimeout(() => createLogin({ actor: 'attacker', service: brand ? brand.name : rest.target, domain: rest.target,
        device: { ...ATTACKER_DEVICE, location: VICTIM_DEVICE.location }, source: 'relay' }), 1500);
    }
    return { ok: true, t: ev.t };
  },
  'POST /api/task/start': (b) => startTask(b.taskId),
  'POST /api/task/end': (b) => endTask(b.notes),
  'POST /api/reset': () => { if (state.task) endTask('reset'); resetWorld(); broadcast({ kind: 'command', command: 'reset-pc' }); changed(); return {}; },
  'POST /api/questionnaire': (b) => {
    const tlx = Array.isArray(b.tlx) ? b.tlx.map(Number) : [];
    const row = { t: Date.now(), participant: state.config.participant, condition: b.condition || state.config.condition,
      block: state.config.block, sus: b.sus, susScore: susScore((b.sus || []).map(Number)), tlx,
      tlxRaw: tlx.length === 6 && tlx.every((x) => x >= 0 && x <= 100) ? tlx.reduce((s, x) => s + x, 0) / 6 : null,
      trust: Number(b.trust) || null, comments: String(b.comments || '').slice(0, 2000) };
    append('questionnaires.jsonl', row);
    return { saved: row };
  },
  'GET /api/results': () => summarize(),
  'GET /api/eval': () => {
    const f = path.join(__dirname, 'eval', 'results', 'summary.json');
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { missing: true };
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ kind: 'state', state: publicState() })}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clients.delete(res); clearInterval(ping); });
    return;
  }
  if (p.startsWith('/api/export/')) {
    const name = p.slice('/api/export/'.length);
    const files = { 'results.csv': 'results.jsonl', 'events.csv': 'events.jsonl', 'questionnaires.csv': 'questionnaires.jsonl' };
    if (!files[name]) return send(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` });
    return res.end(toCsv(readJsonl(files[name])));
  }
  const pushMatch = req.method === 'POST' && p.match(/^\/api\/push\/([a-z0-9]+)$/);
  if (pushMatch) {
    const out = decide(pushMatch[1], (await readBody(req)).decision);
    return send(res, out.error ? 400 : 200, out);
  }
  const handler = routes[`${req.method} ${p}`];
  if (handler) {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const out = handler(body);
    return send(res, out && out.error ? 400 : 200, out || {});
  }
  if (req.method !== 'GET') return send(res, 404, { error: 'not found' });

  const file = path.normalize(path.join(PUBLIC, p === '/' ? 'index.html' : decodeURIComponent(p)));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'forbidden', 'text/plain');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'not found', 'text/plain');
    send(res, 200, buf, MIME[path.extname(file)] || 'application/octet-stream');
  });
});

resetWorld();
server.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal);
  console.log(`VoiceGuard running at http://localhost:${PORT}`);
  if (lan) console.log(`On a phone on the same Wi-Fi, open http://${lan.address}:${PORT}/phone.html`);
});
