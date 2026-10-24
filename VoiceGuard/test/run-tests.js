'use strict';

const assert = require('assert');
const DG = require('../public/js/domain-guard.js');
const PG = require('../public/js/push-guard.js');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const TRUSTED = ['bankofamerica.com', 'wellsfargo.com', 'paypal.com', 'google.com', 'microsoft.com', 'northwindbank.com', 'jazzcash.com.pk'];
const verdict = (u) => DG.analyze(u, TRUSTED);

// ---------- DomainGuard ----------
test('trusted domains and their subdomains are verified', () => {
  assert.strictEqual(verdict('https://www.bankofamerica.com/login').verdict, 'trusted');
  assert.strictEqual(verdict('https://accounts.google.com').verdict, 'trusted');
  assert.strictEqual(verdict('jazzcash.com.pk').registrable, 'jazzcash.com.pk');
});

test('paper examples are caught as repetition attacks', () => {
  for (const [fake, real] of [['bankoffamerica.com', 'bankofamerica.com'], ['wellssfargo.com', 'wellsfargo.com']]) {
    const a = verdict(fake);
    assert.strictEqual(a.verdict, 'lookalike');
    assert.strictEqual(a.attack, 'repetition');
    assert.strictEqual(a.target, real);
  }
});

test('each technique is classified', () => {
  const expect = {
    'gogle.com': 'omission', 'googel.com': 'transposition', 'goofle.com': 'substitution', 'paypa1.com': 'homoglyph',
    'rnicrosoft.com': 'homoglyph', 'xn--pypal-4ve.com': 'homoglyph-unicode', 'paypal.net': 'tld-swap',
    'paypal-login.com': 'combosquat', 'paypal.com.secure-login.net': 'brand-in-subdomain',
    'https://paypal.com@evil.net/': 'userinfo-trick',
  };
  for (const [u, attack] of Object.entries(expect)) assert.strictEqual(verdict(u).attack, attack, u);
});

test('unrelated legitimate sites are unknown, not look-alikes', () => {
  for (const d of ['nytimes.com', 'iba.edu.pk', 'github.com', 'chess.com', 'target.com']) assert.strictEqual(verdict(d).verdict, 'unknown', d);
});

test('punycode decodes to the Unicode label', () => {
  assert.strictEqual(DG.punycodeDecode('pypal-4ve'), 'pаypal');
  assert.strictEqual(DG.punycodeDecode('mnchen-3ya'), 'münchen');
});

test('announcement names the exact difference phonetically', () => {
  const s = DG.announceLink(verdict('bankoffamerica.com'), 'Verify');
  assert.match(s, /double F, as in Foxtrot/);
  assert.match(s, /not bankofamerica dot com/);
  assert.match(DG.announceLink(verdict('paypa1.com')), /digit one in place of the letter L/);
});

test('baseline screen-reader reading makes the paper pair sound identical once doubled letters merge', () => {
  assert.strictEqual(DG.readAsScreenReader('bankoffamerica.com'), 'bankoffamerica dot com');
  assert.strictEqual(DG.squash('bankoffamerica'), DG.squash('bankofamerica'));
});

test('look-alike generator output is always detected against its source', () => {
  for (const real of TRUSTED) {
    for (const attack of DG.ATTACK_TYPES) {
      const fake = DG.makeLookalike(real, attack, 3);
      if (!fake) continue;
      const a = DG.analyze(fake, TRUSTED);
      assert.strictEqual(a.verdict, 'lookalike', `${attack} ${fake}`);
    }
  }
});

// ---------- PushGuard ----------
const dev = { browser: 'Chrome', os: 'Windows', location: 'Karachi' };
let id = 0;
const push = (at, extra) => ({ id: `p${++id}`, account: 'a', service: 'Bank', device: dev, codeWord: 'TIGER', createdAt: at, status: 'pending', ...extra });

test('single push: no warnings and announcement carries context and code word', () => {
  const p = push(0);
  const a = PG.assess(p, [p], 2000, { knownDevices: [PG.deviceKey(dev)] });
  assert.deepStrictEqual(a.warnings, []);
  assert.match(a.announcement, /Chrome on Windows, near Karachi/);
  assert.match(a.announcement, /Code word: TIGER/);
});

test('two pending pushes raise a concurrency warning', () => {
  const v = push(0), x = push(2000, { codeWord: 'MANGO' });
  const a = PG.assess(x, [v, x], 2000);
  assert.ok(a.warnings.some((w) => w.type === 'concurrent'));
  assert.strictEqual(a.pendingCount, 2);
});

test('burst of pushes locks approval and later unlocks after the cooldown', () => {
  const all = [push(0, { status: 'denied' }), push(5000, { status: 'denied' }), push(10000)];
  const a = PG.assess(all[2], all, 10000);
  assert.ok(a.locked);
  assert.ok(a.warnings.some((w) => w.type === 'fatigue'));
  const later = PG.assess(all[2], all, 10000 + PG.DEFAULTS.cooldownMs + 1);
  assert.ok(!later.locked);
});

test('components can be switched off for ablation', () => {
  const v = push(0), x = push(1000);
  const a = PG.assess(x, [v, x], 1000, {}, { concurrency: false, codeWord: false, context: false });
  assert.ok(!a.warnings.some((w) => w.type === 'concurrent'));
  assert.doesNotMatch(a.announcement, /Code word/);
});

test('adaptive expiry grows when speech is slower', () => {
  const p = push(0), q = push(0);
  const slow = PG.assess(p, [p, q], 0, { rate: 0.5 });
  const fast = PG.assess(p, [p, q], 0, { rate: 2 });
  assert.ok(slow.expiresMs > fast.expiresMs);
  assert.ok(fast.expiresMs >= PG.DEFAULTS.baseExpiryMs);
});

let failed = 0;
for (const t of tests) {
  try { t.fn(); console.log(`ok   ${t.name}`); } catch (e) { failed++; console.log(`FAIL ${t.name}\n     ${e.message}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exitCode = failed ? 1 : 0;
