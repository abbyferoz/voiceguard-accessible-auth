/*
 * DomainGuard — look-alike (phishing) domain detection and audio-first
 * announcements for screen-reader users.
 *
 * Addresses Broken Access, Threat 1: screen readers read "bankofamerica.com"
 * and "bankoffamerica.com" identically. DomainGuard finds the closest trusted
 * domain, works out exactly what differs, and says only that difference using
 * the NATO phonetic alphabet, instead of making the user spell the whole URL.
 *
 * Works in the browser (window.DomainGuard) and in Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DomainGuard = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MULTI_PART_SUFFIXES = new Set([
    'co.uk', 'ac.uk', 'gov.uk', 'org.uk', 'com.pk', 'edu.pk', 'gov.pk', 'org.pk',
    'net.pk', 'com.au', 'net.au', 'org.au', 'co.in', 'co.jp', 'com.br', 'com.cn',
    'co.nz', 'co.za', 'com.sg', 'com.tr', 'com.mx',
  ]);

  const NATO = {
    a: 'Alpha', b: 'Bravo', c: 'Charlie', d: 'Delta', e: 'Echo', f: 'Foxtrot',
    g: 'Golf', h: 'Hotel', i: 'India', j: 'Juliett', k: 'Kilo', l: 'Lima',
    m: 'Mike', n: 'November', o: 'Oscar', p: 'Papa', q: 'Quebec', r: 'Romeo',
    s: 'Sierra', t: 'Tango', u: 'Uniform', v: 'Victor', w: 'Whiskey', x: 'X-ray',
    y: 'Yankee', z: 'Zulu', 0: 'digit zero', 1: 'digit one', 2: 'digit two',
    3: 'digit three', 4: 'digit four', 5: 'digit five', 6: 'digit six',
    7: 'digit seven', 8: 'digit eight', 9: 'digit nine', '-': 'dash',
  };

  // Non-Latin characters that render like Latin letters (subset of Unicode TR39).
  const UNICODE_CONFUSABLES = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c',
    'х': 'x', 'у': 'y', 'і': 'i', 'ј': 'j', 'ѕ': 's',
    'ԁ': 'd', 'ɡ': 'g', 'ı': 'i', 'ο': 'o', 'α': 'a',
    'ν': 'v', 'ρ': 'p', 'һ': 'h', 'ո': 'n', 'ս': 'u',
    'à': 'a', 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o',
    'ö': 'o', 'ü': 'u', 'ç': 'c',
  };

  // ASCII sequences that look like other letters on screen.
  const ASCII_CONFUSABLES = [
    ['rn', 'm'], ['vv', 'w'], ['cl', 'd'], ['0', 'o'], ['1', 'l'], ['3', 'e'],
    ['5', 's'], ['!', 'i'],
  ];

  // ---------- Punycode (RFC 3492) decoding, so xn-- labels can be inspected ----------
  const P = { base: 36, tMin: 1, tMax: 26, skew: 38, damp: 700, bias: 72, n: 128 };

  function adapt(delta, numPoints, firstTime) {
    delta = firstTime ? Math.floor(delta / P.damp) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    let k = 0;
    while (delta > ((P.base - P.tMin) * P.tMax) >> 1) {
      delta = Math.floor(delta / (P.base - P.tMin));
      k += P.base;
    }
    return Math.floor(k + ((P.base - P.tMin + 1) * delta) / (delta + P.skew));
  }

  function punycodeDecode(input) {
    const output = [];
    let n = P.n, bias = P.bias, i = 0;
    let basic = input.lastIndexOf('-');
    if (basic < 0) basic = 0;
    for (let j = 0; j < basic; j++) output.push(input.charCodeAt(j));
    for (let index = basic > 0 ? basic + 1 : 0; index < input.length;) {
      const oldi = i;
      let w = 1;
      for (let k = P.base; ; k += P.base) {
        if (index >= input.length) throw new Error('invalid punycode');
        const c = input.charCodeAt(index++);
        let digit = P.base;
        if (c >= 48 && c <= 57) digit = c - 22;
        else if (c >= 65 && c <= 90) digit = c - 65;
        else if (c >= 97 && c <= 122) digit = c - 97;
        if (digit >= P.base) throw new Error('invalid punycode');
        i += digit * w;
        const t = k <= bias ? P.tMin : k >= bias + P.tMax ? P.tMax : k - bias;
        if (digit < t) break;
        w *= P.base - t;
      }
      const len = output.length + 1;
      bias = adapt(i - oldi, len, oldi === 0);
      n += Math.floor(i / len);
      i %= len;
      output.splice(i++, 0, n);
    }
    return String.fromCodePoint(...output);
  }

  // ---------- Parsing ----------
  function parse(input) {
    if (!input || typeof input !== 'string') return null;
    let s = input.trim();
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
    s = s.split(/[/?#]/)[0];
    let userinfo = '';
    const at = s.lastIndexOf('@');
    if (at >= 0) { userinfo = s.slice(0, at).toLowerCase(); s = s.slice(at + 1); }
    s = s.replace(/:\d+$/, '').replace(/\.$/, '').toLowerCase();
    if (!s || !s.includes('.')) return null;
    const labels = s.split('.').map((l) => {
      if (!l.startsWith('xn--')) return l;
      try { return punycodeDecode(l.slice(4)); } catch (e) { return l; }
    });
    if (labels.some((l) => !l)) return null;
    const lastTwo = labels.slice(-2).join('.');
    const suffixLen = labels.length > 2 && MULTI_PART_SUFFIXES.has(lastTwo) ? 2 : 1;
    if (labels.length <= suffixLen) return null;
    const suffix = labels.slice(-suffixLen).join('.');
    const label = labels[labels.length - suffixLen - 1];
    const subdomain = labels.slice(0, labels.length - suffixLen - 1).join('.');
    return {
      host: labels.join('.'),
      registrable: label + '.' + suffix,
      label, suffix, subdomain, userinfo,
      hasUnicode: /[^\x00-\x7f]/.test(labels.join('.')),
    };
  }

  // ---------- String comparison helpers ----------
  function skeleton(s) {
    let out = '';
    for (const ch of s.toLowerCase()) out += UNICODE_CONFUSABLES[ch] || ch;
    for (const [from, to] of ASCII_CONFUSABLES) out = out.split(from).join(to);
    return out;
  }

  function squash(s) { return s.replace(/(.)\1+/g, '$1'); }

  // Optimal-string-alignment (Damerau) distance with the edit script that turns
  // `a` (trusted) into `b` (candidate).
  function editScript(a, b) {
    const A = Array.from(a), B = Array.from(b);
    const n = A.length, m = B.length;
    const d = Array.from({ length: n + 1 }, (_, i) => {
      const row = new Array(m + 1).fill(0);
      row[0] = i;
      return row;
    });
    for (let j = 0; j <= m; j++) d[0][j] = j;
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const cost = A[i - 1] === B[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && A[i - 1] === B[j - 2] && A[i - 2] === B[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    const ops = [];
    let i = n, j = m;
    while (i > 0 || j > 0) {
      if (i > 1 && j > 1 && A[i - 1] === B[j - 2] && A[i - 2] === B[j - 1] &&
          A[i - 1] !== B[j - 1] && d[i][j] === d[i - 2][j - 2] + 1) {
        ops.unshift({ op: 'swap', pos: j - 2, chars: [A[i - 2], A[i - 1]] });
        i -= 2; j -= 2;
      } else if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1)) {
        if (A[i - 1] !== B[j - 1]) ops.unshift({ op: 'sub', pos: j - 1, from: A[i - 1], to: B[j - 1] });
        i--; j--;
      } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) {
        ops.unshift({ op: 'ins', pos: j - 1, char: B[j - 1] });
        j--;
      } else {
        ops.unshift({ op: 'del', pos: j, char: A[i - 1] });
        i--;
      }
    }
    return { distance: d[n][m], ops };
  }

  function maxDistanceFor(len) { return len < 4 ? 0 : len <= 8 ? 1 : 2; }

  // ---------- Analysis ----------
  function compareTo(p, t) {
    const base = { target: t.registrable, targetLabel: t.label };
    if (p.userinfo && (p.userinfo.includes(t.registrable) || p.userinfo === t.label)) {
      return { ...base, attack: 'userinfo-trick', confidence: 0.95 };
    }
    const subTokens = p.subdomain ? p.subdomain.split(/[.-]/) : [];
    if ((t.label.length >= 3 && subTokens.includes(t.label)) || (p.subdomain && p.subdomain.includes(t.registrable))) {
      return { ...base, attack: 'brand-in-subdomain', confidence: 0.9 };
    }
    if (p.label === t.label && p.suffix !== t.suffix && t.label.length >= 3) {
      return { ...base, attack: 'tld-swap', confidence: 0.85, fromSuffix: t.suffix, toSuffix: p.suffix };
    }
    if (p.label !== t.label && skeleton(p.label) === skeleton(t.label)) {
      return { ...base, attack: p.hasUnicode ? 'homoglyph-unicode' : 'homoglyph', confidence: 0.95 };
    }
    if (p.label !== t.label && t.label.length >= 4 && squash(p.label) === squash(t.label)) {
      const { ops, distance } = editScript(t.label, p.label);
      const attack = Array.from(p.label).length > Array.from(t.label).length ? 'repetition' : 'omission';
      return { ...base, attack, confidence: 0.95, ops, distance };
    }
    const sameSuffixOrLong = p.suffix === t.suffix || t.label.length > 5;
    if (p.label !== t.label && sameSuffixOrLong) {
      const { ops, distance } = editScript(t.label, p.label);
      if (distance > 0 && distance <= maxDistanceFor(t.label.length)) {
        let attack = 'typo-multi';
        if (ops.length === 1) {
          const o = ops[0];
          if (o.op === 'ins') {
            const B = Array.from(p.label);
            attack = (B[o.pos - 1] === o.char || B[o.pos + 1] === o.char) ? 'repetition' : 'insertion';
          } else {
            attack = { del: 'omission', sub: 'substitution', swap: 'transposition' }[o.op];
          }
        }
        return { ...base, attack, confidence: 0.9 - 0.1 * (distance - 1), ops, distance };
      }
    }
    if (t.label.length >= 3 && p.label !== t.label) {
      const tokens = p.label.split('-');
      const affix = t.label.length >= 5 && (p.label.startsWith(t.label) || p.label.endsWith(t.label));
      if (tokens.includes(t.label) || affix) {
        const extra = p.label.replace(t.label, '').replace(/^-+|-+$/g, '').replace(/-+/g, ' ');
        return { ...base, attack: 'combosquat', confidence: 0.75, extra };
      }
    }
    return null;
  }

  function analyze(input, trustedList) {
    const p = parse(input);
    if (!p) return { verdict: 'invalid', input };
    const trusted = (trustedList || []).map(parse).filter(Boolean);
    const result = { input, ...p };
    const exact = trusted.find((t) => t.registrable === p.registrable);
    if (exact && !p.userinfo) return { ...result, verdict: 'trusted', target: exact.registrable };

    let best = null;
    for (const t of trusted) {
      if (t.registrable === p.registrable) continue;
      const m = compareTo(p, t);
      if (m && (!best || m.confidence > best.confidence)) best = m;
    }
    if (best) return { ...result, verdict: 'lookalike', ...best };
    if (exact) return { ...result, verdict: 'trusted', target: exact.registrable };
    return { ...result, verdict: 'unknown' };
  }

  // ---------- Speech ----------
  // What a typical screen reader says for a domain: labels as whole words.
  function readAsScreenReader(host) {
    return host.split('.').join(' dot ').replace(/-/g, ' dash ');
  }

  function letter(ch) {
    if (UNICODE_CONFUSABLES[ch]) return `a foreign character that looks like ${UNICODE_CONFUSABLES[ch].toUpperCase()}`;
    const name = NATO[ch];
    if (!name) return `"${ch}"`;
    if (/[0-9]/.test(ch) || ch === '-') return name;
    return `${ch.toUpperCase()}, as in ${name}`;
  }

  function spell(s) {
    return Array.from(s).map((c) => (/[a-z]/.test(c) ? c.toUpperCase() : NATO[c] || c)).join(', ');
  }

  function context(label, pos) {
    const before = Array.from(label).slice(Math.max(0, pos - 3), pos).join('');
    return before ? `, after ${spell(before)}` : ', at the start';
  }

  function describeOp(o, label) {
    switch (o.op) {
      case 'ins': {
        const L = Array.from(label);
        let start = o.pos;
        while (start > 0 && L[start - 1] === o.char) start--;
        if (start < o.pos || L[o.pos + 1] === o.char) return `a double ${letter(o.char)}${context(label, start)}`;
        return `an extra ${letter(o.char)}${context(label, o.pos)}`;
      }
      case 'del': return `a missing ${letter(o.char)}${context(label, o.pos)}`;
      case 'sub': return `${letter(o.to)} where the real site has ${letter(o.from)}`;
      case 'swap': return `the letters ${o.chars[0].toUpperCase()} and ${o.chars[1].toUpperCase()} swapped around`;
      default: return '';
    }
  }

  function describeHomoglyph(a) {
    const parts = [];
    for (const ch of Array.from(a.label)) {
      if (UNICODE_CONFUSABLES[ch]) parts.push(letter(ch));
    }
    for (const [from, to] of ASCII_CONFUSABLES) {
      if (a.label.includes(from) && !a.targetLabel.includes(from)) {
        parts.push(from.length > 1
          ? `the letters ${spell(from)} written together to look like ${to.toUpperCase()}`
          : `${NATO[from] || from} in place of the letter ${to.toUpperCase()}`);
      }
    }
    return parts.length ? `It uses ${parts.join(', and ')}` : 'It uses characters that only look like the real name';
  }

  function describeDifference(a) {
    switch (a.attack) {
      case 'repetition':
      case 'insertion':
      case 'omission':
      case 'substitution':
      case 'transposition':
      case 'typo-multi':
        return 'It has ' + a.ops.map((o) => describeOp(o, a.label)).join(', and ');
      case 'homoglyph':
      case 'homoglyph-unicode':
        return describeHomoglyph(a);
      case 'tld-swap':
        return `It ends in dot ${a.toSuffix.split('.').join(' dot ')}, but the real site ends in dot ${a.fromSuffix.split('.').join(' dot ')}`;
      case 'brand-in-subdomain':
        return `The real address is ${readAsScreenReader(a.registrable)}. The name ${a.targetLabel} is only put at the front to trick you`;
      case 'combosquat':
        return `It adds "${a.extra}" to the real name`;
      case 'userinfo-trick':
        return `The part before the at sign is fake. The link really goes to ${readAsScreenReader(a.host)}`;
      default:
        return '';
    }
  }

  function announceLink(a, linkText) {
    const text = linkText ? `${linkText}. ` : '';
    if (a.verdict === 'trusted') return `Link. ${text}Goes to ${readAsScreenReader(a.registrable)}. Verified site.`;
    if (a.verdict === 'lookalike') {
      return `Warning! Look-alike link. ${text}It goes to ${readAsScreenReader(a.registrable)}, ` +
        `not ${readAsScreenReader(a.target)}. ${describeDifference(a)}. This is likely a phishing site.`;
    }
    if (a.verdict === 'unknown') return `Link. ${text}Goes to ${readAsScreenReader(a.registrable)}, a site not on your trusted list.`;
    return `Link. ${text}`;
  }

  function announcePage(a) {
    if (a.verdict === 'trusted') return `Verified site: ${readAsScreenReader(a.registrable)}.`;
    if (a.verdict === 'lookalike') {
      return `Danger. You are on ${readAsScreenReader(a.registrable)}, a look-alike of ${readAsScreenReader(a.target)}. ` +
        `${describeDifference(a)}. Do not enter your password here.`;
    }
    if (a.verdict === 'unknown') return `You are on ${readAsScreenReader(a.registrable)}. This site is not on your trusted list.`;
    return '';
  }

  // ---------- Look-alike generator (used by the attacker console and the evaluation) ----------
  const KEY_NEIGHBORS = {
    a: 'qs', b: 'vn', c: 'xv', d: 'sf', e: 'wr', f: 'dg', g: 'fh', h: 'gj', i: 'uo',
    j: 'hk', k: 'jl', l: 'k', m: 'n', n: 'bm', o: 'ip', p: 'o', q: 'w', r: 'et',
    s: 'ad', t: 'ry', u: 'yi', v: 'cb', w: 'qe', x: 'zc', y: 'tu', z: 'x',
  };
  const ASCII_LOOKALIKE = { o: '0', l: '1', m: 'rn', w: 'vv', d: 'cl', i: '1', e: '3', s: '5' };
  const UNICODE_LOOKALIKE = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', i: 'і' };

  const ATTACK_TYPES = [
    'repetition', 'omission', 'transposition', 'substitution', 'homoglyph',
    'homoglyph-unicode', 'tld-swap', 'combosquat', 'brand-in-subdomain',
  ];

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeLookalike(domain, attack, seed) {
    const rand = mulberry32(seed || 1);
    const p = parse(domain);
    if (!p) return null;
    const L = Array.from(p.label);
    const pick = (cands) => cands[Math.floor(rand() * cands.length)];
    const inner = (pred) => {
      const idx = L.map((c, i) => i).filter((i) => i > 0 && i < L.length - 1 && pred(L[i], i));
      return idx.length ? pick(idx) : -1;
    };
    let label = p.label, suffix = p.suffix, prefix = '';
    switch (attack) {
      case 'repetition': {
        const i = inner((c) => /[a-z]/.test(c));
        if (i < 0) return null;
        label = L.slice(0, i + 1).join('') + L[i] + L.slice(i + 1).join('');
        break;
      }
      case 'omission': {
        const i = inner((c, k) => /[a-z]/.test(c) && L[k - 1] !== c && L[k + 1] !== c);
        if (i < 0) return null;
        label = L.slice(0, i).join('') + L.slice(i + 1).join('');
        break;
      }
      case 'transposition': {
        const i = inner((c, k) => k < L.length - 2 && L[k + 1] !== c && /[a-z]/.test(L[k + 1]));
        if (i < 0) return null;
        const M = L.slice();
        [M[i], M[i + 1]] = [M[i + 1], M[i]];
        label = M.join('');
        break;
      }
      case 'substitution': {
        const i = inner((c) => !!KEY_NEIGHBORS[c]);
        if (i < 0) return null;
        const M = L.slice();
        M[i] = pick(Array.from(KEY_NEIGHBORS[L[i]]));
        label = M.join('');
        break;
      }
      case 'homoglyph': {
        const idx = L.map((c, i) => i).filter((i) => ASCII_LOOKALIKE[L[i]]);
        if (!idx.length) return null;
        const i = pick(idx);
        const M = L.slice();
        M[i] = ASCII_LOOKALIKE[L[i]];
        label = M.join('');
        break;
      }
      case 'homoglyph-unicode': {
        const idx = L.map((c, i) => i).filter((i) => UNICODE_LOOKALIKE[L[i]]);
        if (!idx.length) return null;
        const i = pick(idx);
        const M = L.slice();
        M[i] = UNICODE_LOOKALIKE[L[i]];
        label = M.join('');
        break;
      }
      case 'tld-swap':
        suffix = pick(['net', 'co', 'org', 'info', 'online'].filter((s) => s !== p.suffix));
        break;
      case 'combosquat':
        label = p.label + '-' + pick(['login', 'secure', 'verify', 'support', 'account']);
        break;
      case 'brand-in-subdomain':
        prefix = p.registrable + '.';
        label = pick(['account-verify', 'secure-login', 'auth-check', 'user-portal']);
        suffix = pick(['net', 'info', 'online', 'site']);
        break;
      default:
        return null;
    }
    const out = prefix + label + '.' + suffix;
    return out === p.registrable ? null : out;
  }

  return {
    parse, analyze, skeleton, squash, editScript, punycodeDecode,
    readAsScreenReader, spell, describeDifference, announceLink, announcePage,
    makeLookalike, ATTACK_TYPES, NATO,
  };
});
