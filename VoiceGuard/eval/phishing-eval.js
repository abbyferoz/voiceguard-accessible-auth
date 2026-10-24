/*
 * Automated phishing evaluation (AWARE-style, no participants).
 *
 * For every trusted domain and every look-alike technique we generate spoofed
 * domains, then measure:
 *   1. detection: does DomainGuard flag it, and name the right real site?
 *   2. false alarms: legitimate domains that are NOT on the trusted list
 *   3. audible similarity: TF-IDF cosine similarity (as in the paper) between
 *      what the user hears for the real link and for the spoofed link,
 *      for today's screen-reader reading and for VoiceGuard's announcement
 *   4. listening cost: seconds to hear VoiceGuard's difference vs. spelling
 *      the whole address character by character
 *
 *   node eval/phishing-eval.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const DG = require('../public/js/domain-guard.js');
const { speechSeconds } = require('../public/js/push-guard.js');

const TRUSTED = [
  'google.com', 'youtube.com', 'facebook.com', 'amazon.com', 'wikipedia.org', 'twitter.com', 'instagram.com',
  'linkedin.com', 'netflix.com', 'microsoft.com', 'apple.com', 'paypal.com', 'bankofamerica.com', 'wellsfargo.com',
  'chase.com', 'citibank.com', 'hsbc.com', 'ebay.com', 'yahoo.com', 'outlook.com', 'office.com', 'dropbox.com',
  'github.com', 'adobe.com', 'spotify.com', 'zoom.us', 'slack.com', 'whatsapp.com', 'telegram.org', 'reddit.com',
  'pinterest.com', 'tiktok.com', 'walmart.com', 'americanexpress.com', 'capitalone.com', 'coinbase.com',
  'binance.com', 'stripe.com', 'shopify.com', 'salesforce.com', 'icloud.com', 'docusign.com', 'fedex.com',
  'daraz.pk', 'hbl.com', 'meezanbank.com', 'jazzcash.com.pk', 'easypaisa.com.pk', 'ubldigital.com', 'bankalfalah.com',
];

// Real, legitimate sites that are not on the trusted list: any warning here is a false alarm.
const LEGIT_OTHERS = [
  'nytimes.com', 'bbc.co.uk', 'cnn.com', 'iba.edu.pk', 'lums.edu.pk', 'mit.edu', 'stanford.edu', 'stackoverflow.com',
  'medium.com', 'quora.com', 'imdb.com', 'booking.com', 'airbnb.com', 'uber.com', 'careem.com', 'foodpanda.pk',
  'dawn.com', 'geo.tv', 'espn.com', 'nasa.gov', 'who.int', 'un.org', 'w3.org', 'mozilla.org', 'python.org',
  'nodejs.org', 'npmjs.com', 'docker.com', 'kaggle.com', 'coursera.org', 'udemy.com', 'khanacademy.org',
  'duolingo.com', 'canva.com', 'figma.com', 'notion.so', 'trello.com', 'asana.com', 'atlassian.com',
  'cloudflare.com', 'digitalocean.com', 'heroku.com', 'vercel.com', 'netlify.com', 'wordpress.com', 'blogger.com',
  'tumblr.com', 'twitch.tv', 'discord.com', 'signal.org', 'proton.me', 'gmail.com', 'aliexpress.com', 'alibaba.com',
  'etsy.com', 'ikea.com', 'nike.com', 'adidas.com', 'samsung.com', 'dell.com', 'lenovo.com', 'intel.com',
  'nvidia.com', 'oracle.com', 'ibm.com', 'cisco.com', 'bing.com', 'duckduckgo.com', 'baidu.com', 'weather.com',
  'imgur.com', 'vimeo.com', 'soundcloud.com', 'steampowered.com', 'epicgames.com', 'roblox.com', 'nature.com',
  'springer.com', 'acm.org', 'ieee.org', 'arxiv.org', 'researchgate.net', 'chess.com', 'target.com', 'usps.com',
];

const SEEDS = [1, 2, 3];
const RATE = 1;

// ---------- what the listener hears ----------
const DIGIT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

// Phonetic normalisation of a spoken word: spellings that a speech engine
// pronounces the same way map to the same string (doubled letters, c/k, ph/f…).
// Non-Latin look-alike letters are voiced like their Latin twin.
function phoneticWord(word) {
  let w = DG.skeleton(word.normalize('NFC')).replace(/[^\x00-\x7f]/g, '');
  w = w.toLowerCase();
  w = w.replace(/[0-9]/g, (d) => ` ${DIGIT_WORDS[+d]} `);
  return w.split(/\s+/).filter(Boolean).map((part) => part
    .replace(/[^a-z]/g, '')
    .replace(/^kn/, 'n').replace(/^wr/, 'r').replace(/^ps/, 's')
    .replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/gh/g, 'g')
    .replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/q/g, 'k').replace(/x/g, 'ks').replace(/z/g, 's')
    .replace(/y/g, 'i')
    .replace(/(.)\1+/g, '$1')).join(' ');
}

function heard(text) {
  return text.toLowerCase().replace(/[.,!?:;"()]/g, ' ').split(/\s+/).filter(Boolean).map(phoneticWord).join(' ');
}

// Real screen readers do not map digits inside words back to letters, so for the
// baseline reading we only voice Unicode confusables as their Latin twin.
function heardBaseline(host) {
  const spoken = DG.readAsScreenReader(host);
  return spoken.toLowerCase().split(/\s+/).map((w) => {
    let out = '';
    for (const ch of w) out += /[^\x00-\x7f]/.test(ch) ? DG.skeleton(ch) : ch;
    return out.replace(/[0-9]/g, (d) => ` ${DIGIT_WORDS[+d]} `);
  }).join(' ').split(/\s+/).filter(Boolean).map((w) => w
    .replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k')
    .replace(/q/g, 'k').replace(/x/g, 'ks').replace(/z/g, 's').replace(/y/g, 'i').replace(/(.)\1+/g, '$1')).join(' ');
}

// ---------- TF-IDF cosine similarity over character trigrams ----------
function grams(text) {
  const t = `  ${text}  `;
  const g = new Map();
  for (let i = 0; i < t.length - 2; i++) { const k = t.slice(i, i + 3); g.set(k, (g.get(k) || 0) + 1); }
  return g;
}

function tfidfModel(corpus) {
  const df = new Map();
  for (const doc of corpus) for (const k of grams(doc).keys()) df.set(k, (df.get(k) || 0) + 1);
  const N = corpus.length;
  const idf = (k) => Math.log((1 + N) / (1 + (df.get(k) || 0))) + 1; // smoothed, as in scikit-learn
  const vec = (doc) => {
    const v = new Map();
    for (const [k, tf] of grams(doc)) v.set(k, tf * idf(k));
    return v;
  };
  return (a, b) => {
    const va = vec(a), vb = vec(b);
    let dot = 0, na = 0, nb = 0;
    for (const [k, x] of va) { na += x * x; if (vb.has(k)) dot += x * vb.get(k); }
    for (const x of vb.values()) nb += x * x;
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  };
}

// ---------- run ----------
function run() {
  const cases = [];
  for (const real of TRUSTED) {
    for (const attack of DG.ATTACK_TYPES) {
      const seen = new Set();
      for (const seed of SEEDS) {
        const fake = DG.makeLookalike(real, attack, seed * 7919 + real.length);
        if (!fake || seen.has(fake) || TRUSTED.includes(fake)) continue;
        seen.add(fake);
        cases.push({ real, fake, attack });
      }
    }
  }

  // Texts heard in each condition, used to fit the TF-IDF model on the whole corpus.
  for (const c of cases) {
    const realA = DG.analyze('https://' + c.real, TRUSTED);
    const fakeA = DG.analyze('https://' + c.fake, TRUSTED);
    c.verdict = fakeA.verdict;
    c.detectedTarget = fakeA.target || '';
    c.detectedAttack = fakeA.attack || '';
    c.detected = fakeA.verdict === 'lookalike';
    c.correctTarget = c.detected && fakeA.target === c.real;
    c.baseReal = heardBaseline(DG.parse(c.real).host);
    c.baseFake = heardBaseline(DG.parse(c.fake).host);
    c.guardRealText = DG.announceLink(realA);
    c.guardFakeText = DG.announceLink(fakeA);
    c.guardReal = heard(c.guardRealText);
    c.guardFake = heard(c.guardFakeText);
    c.spellSeconds = speechSeconds(DG.spell(DG.parse(c.fake).host.replace(/\./g, '')) .split(', ').join(' '), RATE) +
      (DG.parse(c.fake).host.split('.').length - 1) * (60 / 180); // each "dot"
    c.diffSeconds = c.detected ? speechSeconds(DG.describeDifference(fakeA), RATE) : 0;
    c.announceSeconds = speechSeconds(c.guardFakeText, RATE);
  }
  const corpus = cases.flatMap((c) => [c.baseReal, c.baseFake, c.guardReal, c.guardFake]);
  const sim = tfidfModel(corpus);
  for (const c of cases) {
    c.baselineSimilarity = sim(c.baseReal, c.baseFake);
    c.guardSimilarity = sim(c.guardReal, c.guardFake);
  }

  const legit = LEGIT_OTHERS.map((d) => {
    const a = DG.analyze('https://' + d, TRUSTED);
    return { domain: d, verdict: a.verdict, flaggedAs: a.target || '', attack: a.attack || '' };
  });
  const falseAlarms = legit.filter((l) => l.verdict === 'lookalike');

  // Paper's own examples, reproduced.
  const paperPairs = [['bankofamerica.com', 'bankoffamerica.com'], ['wellsfargo.com', 'wellssfargo.com']].map(([r, f]) => {
    const fa = DG.analyze('https://' + f, TRUSTED);
    return { real: r, fake: f, baselineHeardReal: heardBaseline(r), baselineHeardFake: heardBaseline(f),
      baselineSimilarity: sim(heardBaseline(r), heardBaseline(f)),
      guardSimilarity: sim(heard(DG.announceLink(DG.analyze('https://' + r, TRUSTED))), heard(DG.announceLink(fa))),
      guardSays: DG.announceLink(fa) };
  });

  const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  const byAttack = {};
  for (const t of DG.ATTACK_TYPES) {
    const g = cases.filter((c) => c.attack === t);
    byAttack[t] = {
      n: g.length,
      detectionRate: mean(g.map((c) => (c.detected ? 1 : 0))),
      correctTargetRate: mean(g.map((c) => (c.correctTarget ? 1 : 0))),
      baselineSimilarity: mean(g.map((c) => c.baselineSimilarity)),
      guardSimilarity: mean(g.map((c) => c.guardSimilarity)),
      audiblyIdenticalBaseline: mean(g.map((c) => (c.baselineSimilarity > 0.999 ? 1 : 0))),
      diffSeconds: mean(g.filter((c) => c.detected).map((c) => c.diffSeconds)),
      spellSeconds: mean(g.map((c) => c.spellSeconds)),
    };
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    phishing: {
      nTrusted: TRUSTED.length,
      nAttacks: cases.length,
      nLegit: legit.length,
      detectionRate: mean(cases.map((c) => (c.detected ? 1 : 0))),
      correctTargetRate: mean(cases.map((c) => (c.correctTarget ? 1 : 0))),
      falsePositiveRate: falseAlarms.length / legit.length,
      falseAlarms,
      baselineMeanSimilarity: mean(cases.map((c) => c.baselineSimilarity)),
      guardMeanSimilarity: mean(cases.map((c) => c.guardSimilarity)),
      audiblyIdenticalBaseline: mean(cases.map((c) => (c.baselineSimilarity > 0.999 ? 1 : 0))),
      meanGuardSeconds: mean(cases.filter((c) => c.detected).map((c) => c.diffSeconds)),
      meanAnnouncementSeconds: mean(cases.filter((c) => c.detected).map((c) => c.announceSeconds)),
      meanSpellSeconds: mean(cases.map((c) => c.spellSeconds)),
      missed: cases.filter((c) => !c.detected).map((c) => ({ real: c.real, fake: c.fake, attack: c.attack })),
      byAttack,
      paperPairs,
    },
  };

  const outDir = path.join(__dirname, 'results');
  fs.mkdirSync(outDir, { recursive: true });
  const existing = fs.existsSync(path.join(outDir, 'summary.json')) ? JSON.parse(fs.readFileSync(path.join(outDir, 'summary.json'), 'utf8')) : {};
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({ ...existing, ...summary }, null, 2));

  const cols = ['real', 'fake', 'attack', 'verdict', 'detectedAttack', 'detectedTarget', 'correctTarget',
    'baselineSimilarity', 'guardSimilarity', 'spellSeconds', 'diffSeconds', 'announceSeconds'];
  const csv = [cols.join(',')].concat(cases.map((c) => cols.map((k) => {
    const v = c[k];
    return typeof v === 'number' ? v.toFixed(4) : `"${String(v).replace(/"/g, '""')}"`;
  }).join(','))).join('\n');
  fs.writeFileSync(path.join(outDir, 'phishing_eval.csv'), csv);

  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const p = summary.phishing;
  const md = [
    '# Phishing evaluation results',
    '',
    `Generated ${summary.generatedAt} with \`node eval/phishing-eval.js\`.`,
    '',
    `- Trusted domains: ${p.nTrusted}. Generated look-alikes: ${p.nAttacks}. Legitimate non-trusted domains: ${p.nLegit}.`,
    `- Detection rate: **${pct(p.detectionRate)}**. Correct real site named: **${pct(p.correctTargetRate)}**.`,
    `- False-alarm rate on legitimate domains: **${pct(p.falsePositiveRate)}** (${p.falseAlarms.map((f) => `${f.domain} → ${f.flaggedAs}`).join(', ') || 'none'}).`,
    `- Mean spoken similarity, real vs fake: screen reader today **${pct(p.baselineMeanSimilarity)}**, VoiceGuard **${pct(p.guardMeanSimilarity)}**.`,
    `- Look-alikes that sound identical today: **${pct(p.audiblyIdenticalBaseline)}**.`,
    `- Listening time: VoiceGuard's difference sentence ${p.meanGuardSeconds.toFixed(1)} s (full warning ${p.meanAnnouncementSeconds.toFixed(1)} s) vs ${p.meanSpellSeconds.toFixed(1)} s to spell the whole address.`,
    '',
    '## Paper examples',
    '',
    '| Real | Fake | Similarity today | Similarity with VoiceGuard | VoiceGuard says |',
    '|---|---|---|---|---|',
    ...p.paperPairs.map((x) => `| ${x.real} | ${x.fake} | ${pct(x.baselineSimilarity)} | ${pct(x.guardSimilarity)} | ${x.guardSays} |`),
    '',
    '## By technique',
    '',
    '| Technique | n | Detected | Right target | Sounds identical today | Similarity today | Similarity VoiceGuard | Diff (s) | Spell (s) |',
    '|---|---|---|---|---|---|---|---|---|',
    ...Object.entries(p.byAttack).map(([k, v]) => `| ${k} | ${v.n} | ${pct(v.detectionRate)} | ${pct(v.correctTargetRate)} | ${pct(v.audiblyIdenticalBaseline)} | ${pct(v.baselineSimilarity)} | ${pct(v.guardSimilarity)} | ${v.diffSeconds.toFixed(1)} | ${v.spellSeconds.toFixed(1)} |`),
    '',
    p.missed.length ? `Missed: ${p.missed.map((m) => `${m.fake} (${m.attack} of ${m.real})`).join(', ')}` : 'Missed: none.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'phishing_results.md'), md);
  console.log(md);
}

run();
