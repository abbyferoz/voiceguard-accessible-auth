/*
 * VoiceGuard "blind user" session recorder.
 *
 * Drives the real app in a real browser, keyboard-only, the way a screen-reader
 * user would. Every announcement the app makes is captured from the app's own
 * "Spoken output" transcript panel, plus a focus log (what a screen reader
 * announces when focus moves).
 *
 * usage: node run-session.js <condition> <participant> [outfile]
 */
'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:3100';
const CONDITION = process.argv[2] || 'baseline';
const PARTICIPANT = process.argv[3] || 'P01';
const OUTFILE = process.argv[4] || path.join(__dirname, `session-${CONDITION}.json`);
const PASSWORD = 'study-password-1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- recording ----------
const rec = [];          // everything the "screen reader" said, in order
const actions = [];      // what the blind user did
let T0 = Date.now();

function recSay(dev, text, level) {
  rec.push({ kind: 'say', dev, t: Date.now() - T0, level: level || '', text });
}
function recFocus(dev, label) {
  rec.push({ kind: 'focus', dev, t: Date.now() - T0, text: label });
}
function act(device, action, detail) {
  actions.push({ device, action, detail: detail || '', t: Date.now() - T0 });
}

// ---------- server ----------
async function api(path_, body) {
  const res = await fetch(BASE + path_, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return res.json();
}
async function getState() { return (await fetch(BASE + '/api/state')).json(); }

// ---------- browser ----------
async function instrument(page, dev) {
  await page.addInitScript((dev) => {
    window.__dev = dev;
    window.__rec = [];
    const install = () => {
      const box = document.getElementById('transcript');
      if (box) {
        new MutationObserver((muts) => {
          for (const m of muts) {
            for (const n of m.addedNodes) {
              if (n.nodeType !== 1) continue;
              const time = n.querySelector('time');
              const text = (n.textContent || '').replace(/\s+/g, ' ').trim();
              window.__rec.push({
                k: 'say', time: time ? time.textContent : '', text,
                level: (n.className || '').trim(),
              });
            }
          }
        }).observe(box, { childList: true, subtree: true });
      }
      document.addEventListener('focusin', (e) => {
        const el = e.target;
        if (!el || !el.tagName) return;
        let label = el.getAttribute('aria-label') || '';
        if (!label) {
          if (el.id === 'pass') label = 'Password';
          else if (el.id === 'user') label = 'Email';
          else label = (el.textContent || el.value || el.tagName).replace(/\s+/g, ' ').trim();
        }
        window.__rec.push({ k: 'focus', text: label.slice(0, 90), tag: el.tagName });
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
  }, dev);
}

async function focusInfo(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || !el.tagName) return null;
    const card = el.closest ? el.closest('[data-id]') : null;
    const ds = el.dataset || {};
    return {
      tag: el.tagName,
      id: el.id || '',
      act: ds.act || ds.go || ds.id || ds.key || ds.tool || ds.url || '',
      cardId: card ? card.dataset.id : '',
      text: (el.getAttribute('aria-label') || el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 90),
    };
  });
}

async function tabUntil(page, dev, pred, max = 80) {
  for (let i = 0; i < max; i++) {
    const f = await focusInfo(page);
    if (f && pred(f)) { act(dev, 'focus-reached', `${f.tag} ${f.act || ''} "${f.text}"`); return f; }
    await page.keyboard.press('Tab');
    await sleep(70);
  }
  const f = await focusInfo(page);
  throw new Error(`tabUntil failed on ${dev}: ${JSON.stringify(f)}`);
}

async function drain(page, dev) {
  const rows = await page.evaluate(() => window.__rec);
  for (const r of rows) {
    if (r.k === 'say') recSay(dev, r.text, r.level);
    else recFocus(dev, r.text);
  }
  await page.evaluate(() => { window.__rec = []; });
}

async function waitSpeech(page, timeout = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const n = await page.evaluate(() => window.__rec.filter((r) => r.k === 'say').length);
    if (n > 0) return true;
    await sleep(120);
  }
  return false;
}

async function waitPending(min = 1, timeout = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const s = await getState();
    if (s.pushes.filter((p) => p.status === 'pending').length >= min) return s;
    await sleep(200);
  }
  return getState();
}

// ---------- session ----------
let pc, phone, study;

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXE ||
      '/Users/tiger/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('vg-voice', 'sr');        // "My screen reader": announcements go to ARIA live regions
      localStorage.setItem('vg-auto-voice', 'off');  // no microphone in this environment
    } catch (e) { /* ignore */ }
  });

  pc = await ctx.newPage();
  phone = await ctx.newPage();
  study = await ctx.newPage();
  await instrument(pc, 'PC');
  await instrument(phone, 'PHONE');
  await instrument(study, 'STUDY');

  await pc.goto(`${BASE}/pc.html`);
  await phone.goto(`${BASE}/phone.html`);
  await study.goto(`${BASE}/study.html`);
  await sleep(1200);

  // Turn on each device's audio gate (a real user must click once).
  for (const p of [pc, phone]) {
    const btn = await p.$('#audio-gate button');
    if (btn) { await btn.click(); await sleep(400); }
  }
  await drain(pc, 'PC');
  await drain(phone, 'PHONE');

  // Experimenter: set up the block.
  await api('/api/config', { participant: PARTICIPANT, block: 1, condition: CONDITION, brandSet: 'A' });
  await sleep(500);
  await drain(pc, 'PC');
  await drain(phone, 'PHONE');

  const tasks = [
    { id: 'legit_email', run: runLegitEmail },
    { id: 'legit_login', run: runLegitLogin },
    { id: 'phish_typo', run: runPhishTypo },
    { id: 'phish_subdomain', run: runPhishSubdomain },
    { id: 'concurrent', run: runConcurrent },
    { id: 'fatigue', run: runFatigue },
  ];

  const summary = [];
  for (const t of tasks) {
    const st = await getState();
    const instruction = (st.tasks.find((x) => x.id === t.id) || {}).instruction || '';
    rec.push({ kind: 'instruction', dev: 'EXPERIMENTER', t: Date.now() - T0, text: instruction });

    await api('/api/task/start', { taskId: t.id });
    await sleep(900);
    await drain(pc, 'PC');
    await drain(phone, 'PHONE');

    await t.run();

    await api('/api/task/end', { notes: 'blind user session' });
    await sleep(500);
    await drain(pc, 'PC');
    await drain(phone, 'PHONE');

    const res = await (await fetch(BASE + '/api/results')).json();
    const rows = (res.rows || []).filter((r) => r.participant === PARTICIPANT);
    const row = rows.slice(-1)[0] || {};
    summary.push({ task: t.id, condition: CONDITION, outcome: row.outcome, detail: row.detail,
      warningsHeard: row.warningsHeard, decisionMs: row.decisionMs, durationMs: row.durationMs,
      pushesSent: row.pushesSent, pushesBeforeApproval: row.pushesBeforeApproval });
  }

  fs.writeFileSync(OUTFILE, JSON.stringify({ condition: CONDITION, participant: PARTICIPANT,
    base: BASE, startedAt: T0, summary, actions, rec }, null, 2));
  console.log(`\n=== ${CONDITION.toUpperCase()} ===`);
  for (const s of summary) console.log(`${s.task.padEnd(18)} ${String(s.outcome).padEnd(16)} ${s.detail || ''}`);
  console.log(`\ntranscript lines: ${rec.filter((r) => r.kind === 'say').length} -> ${OUTFILE}`);

  await browser.close();
}

// ---------- helpers shared by tasks ----------
async function openCampusMail() {
  await tabUntil(pc, 'PC', (f) => f.act.startsWith('https://mail.campusmail.edu'));
  act('PC', 'key', 'Enter — open Campus Mail bookmark');
  await pc.keyboard.press('Enter');
  await sleep(700);
}

// The inbox always holds the two background mails first, so the task email has to be
// picked out by its subject rather than by position.
async function openMailButton(subjectRe) {
  await tabUntil(pc, 'PC', (f) => /^m\d+$/.test(f.act) && subjectRe.test(f.text));
  act('PC', 'key', 'Enter — open the message');
  await pc.keyboard.press('Enter');
  await sleep(700);
}

async function focusPhishLink() {
  await tabUntil(pc, 'PC', (f) => f.tag === 'A');
  await sleep(400);
}

async function typePassword() {
  await tabUntil(pc, 'PC', (f) => f.id === 'pass');
  act('PC', 'type', `password into the password field`);
  await pc.keyboard.type(PASSWORD);
  await tabUntil(pc, 'PC', (f) => f.tag === 'BUTTON' && /sign in/i.test(f.text));
  act('PC', 'key', 'Enter — submit the sign-in form');
  await pc.keyboard.press('Enter');
  await sleep(1200);
}

function codeWordFromPc() {
  for (let i = rec.length - 1; i >= 0; i--) {
    const r = rec[i];
    if (r.kind !== 'say' || r.dev !== 'PC') continue;
    const m = r.text.match(/code word is ([A-Z]+)/i);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

async function phoneCardIds() {
  return pageCards();
}
async function pageCards() {
  return phone.evaluate(() => Array.from(document.querySelectorAll('#pushes article')).map((a) => ({
    id: a.dataset.id, heading: (a.querySelector('h2') || {}).textContent || '',
    code: (a.querySelector('.code-word') || {}).textContent || '',
    locked: !!a.querySelector('[aria-disabled="true"]'),
  })));
}

// ---------- the six scripted tasks ----------
async function runLegitEmail() {
  await openCampusMail();
  await openMailButton(/statement/i);
  await focusPhishLink();
  act('PC', 'key', 'Enter — follow the statement link');
  await pc.keyboard.press('Enter');
  await sleep(900);
  await typePassword();
  await waitPending(1);
  await waitSpeech(phone);
  await sleep(700);
  await drain(pc, 'PC');
  await drain(phone, 'PHONE');

  const s = await getState();
  const victim = s.pushes.find((p) => p.actor === 'victim' && p.status === 'pending');
  await tabUntil(phone, 'PHONE', (f) => f.act === 'approve' && (!victim || f.cardId === victim.id));
  act('PHONE', 'key', 'Enter — approve the sign-in request');
  await phone.keyboard.press('Enter');
  await sleep(1000);
}

async function runLegitLogin() {
  await tabUntil(pc, 'PC', (f) => f.act.includes('contosopay.com'));
  act('PC', 'key', 'Enter — open the payment app bookmark');
  await pc.keyboard.press('Enter');
  await sleep(900);
  await typePassword();
  await waitPending(1);
  await waitSpeech(phone);
  await sleep(700);
  await drain(pc, 'PC');
  await drain(phone, 'PHONE');

  const s = await getState();
  const victim = s.pushes.find((p) => p.actor === 'victim' && p.status === 'pending');
  await tabUntil(phone, 'PHONE', (f) => f.act === 'approve' && (!victim || f.cardId === victim.id));
  act('PHONE', 'key', 'Enter — approve the sign-in request');
  await phone.keyboard.press('Enter');
  await sleep(1000);
}

async function runPhish(what) {
  await openCampusMail();
  await openMailButton(what === 'typo' ? /unusual sign-in/i : /refund/i);
  await focusPhishLink();
  await sleep(600);
  await drain(pc, 'PC');

  const isGuard = (await getState()).config.condition === 'guard';
  if (!isGuard) {
    // No warning in the baseline: the link is announced like any other link, so the
    // participant follows it and signs in on the fake site.
    act('PC', 'key', 'Enter — follow the link (no warning heard)');
    await pc.keyboard.press('Enter');
    await sleep(900);
    await typePassword();
    await waitPending(1);
    await waitSpeech(phone);
    await sleep(900);
    await drain(pc, 'PC');
    await drain(phone, 'PHONE');
    const s = await getState();
    const attacker = s.pushes.find((p) => p.actor === 'attacker' && p.status === 'pending');
    if (attacker) {
      await tabUntil(phone, 'PHONE', (f) => f.act === 'approve' && f.cardId === attacker.id);
      act('PHONE', 'key', 'Enter — approve the request (thought it was the sign-in just made)');
      await phone.keyboard.press('Enter');
      await sleep(900);
    }
    return;
  }

  // VoiceGuard: the warning is heard on focus. The participant still activates the
  // link to check, and the interstitial blocks it.
  act('PC', 'key', 'Enter — activate the link despite the warning');
  await pc.keyboard.press('Enter');
  await sleep(900);
  await drain(pc, 'PC');
  await tabUntil(pc, 'PC', (f) => f.id === 'int-back');
  act('PC', 'key', 'Enter — "Go back to safety"');
  await pc.keyboard.press('Enter');
  await sleep(800);
  await drain(pc, 'PC');
  // The participant then reports the message as phishing.
  await tabUntil(pc, 'PC', (f) => f.id === 'report');
  act('PC', 'key', 'Enter — report the email as phishing');
  await pc.keyboard.press('Enter');
  await sleep(800);
  await drain(pc, 'PC');
}

async function runPhishTypo() { await runPhish('typo'); }
async function runPhishSubdomain() { await runPhish('subdomain'); }

async function runConcurrent() {
  await tabUntil(pc, 'PC', (f) => f.act.includes('northwindbank.com'));
  act('PC', 'key', 'Enter — open the bank bookmark');
  await pc.keyboard.press('Enter');
  await sleep(900);
  await typePassword();

  // Both the victim's and the attacker's request arrive; wait for two.
  await waitPending(2, 20000);
  await waitSpeech(phone);
  await sleep(1500);
  await drain(pc, 'PC');
  await drain(phone, 'PHONE');

  const s = await getState();
  const cw = codeWordFromPc();
  const victim = s.pushes.find((p) => p.actor === 'victim' && p.status === 'pending');
  const attacker = s.pushes.find((p) => p.actor === 'attacker' && p.status === 'pending');
  const mine = cw ? s.pushes.find((p) => p.codeWord === cw && p.status === 'pending') : null;

  if (cw && mine) {
    act('PC', 'note', `code word heard on the computer: ${cw}`);
    await tabUntil(phone, 'PHONE', (f) => f.act === 'approve' && f.cardId === mine.id);
    act('PHONE', 'key', `Enter — approve the request whose code word is ${cw}`);
    await phone.keyboard.press('Enter');
    await sleep(1200);
    await drain(phone, 'PHONE');
    if (attacker) {
      await tabUntil(phone, 'PHONE', (f) => f.act === 'report' && f.cardId === attacker.id);
      act('PHONE', 'key', 'Enter — report the other request');
      await phone.keyboard.press('Enter');
      await sleep(900);
    }
  } else {
    // Baseline: no code word, and only the newest request is on screen.
    const target = attacker || victim;
    await tabUntil(phone, 'PHONE', (f) => f.act === 'approve' && f.cardId === target.id);
    act('PHONE', 'key', 'Enter — approve the request that is on screen');
    await phone.keyboard.press('Enter');
    await sleep(1000);
  }
  await drain(pc, 'PC');
  await drain(phone, 'PHONE');
}

async function runFatigue() {
  // 6 attacker pushes, 10 s apart, starting 5 s after the task starts.
  const s0 = await getState();
  const guard = s0.config.condition === 'guard';
  for (let i = 0; i < 6; i++) {
    await waitPending(1, 25000);
    await waitSpeech(phone);
    await sleep(1200);
    await drain(phone, 'PHONE');
    await drain(pc, 'PC');

    if (guard && i === 1) {
      // A diligent screen-reader user re-reads the waiting list.
      const has = await phone.$('[data-tool="read-all"]');
      if (has) {
        await tabUntil(phone, 'PHONE', (f) => f.act === 'read-all');
        act('PHONE', 'key', 'Enter — "Read all waiting requests"');
        await phone.keyboard.press('Enter');
        await sleep(1500);
        await drain(phone, 'PHONE');
      }
    }

    const s = await getState();
    const pending = s.pushes.filter((p) => p.status === 'pending');
    if (!pending.length) break;
    const target = pending[pending.length - 1];
    const cards = await pageCards();
    const card = cards.find((c) => c.id === target.id);
    const locked = card ? card.locked : false;
    if (locked) {
      act('PHONE', 'note', 'Approve is locked on this request');
      // Try to approve anyway — the phone explains why it is locked.
      await tabUntil(phone, 'PHONE', (f) => f.act === 'approve' && f.cardId === target.id);
      act('PHONE', 'key', 'Enter — try to approve the locked request');
      await phone.keyboard.press('Enter');
      await sleep(700);
      await drain(phone, 'PHONE');
    }
    await tabUntil(phone, 'PHONE', (f) => f.act === 'deny' && f.cardId === target.id);
    act('PHONE', 'key', 'Enter — deny the request (never signed in)');
    await phone.keyboard.press('Enter');
    await sleep(900);
    await drain(phone, 'PHONE');
  }
  await sleep(1000);
  await drain(pc, 'PC');
  await drain(phone, 'PHONE');
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
