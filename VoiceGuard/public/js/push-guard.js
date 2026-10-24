/*
 * PushGuard — concurrent-login and notification-fatigue protection for
 * screen-reader-assisted push authentication.
 *
 * Addresses Broken Access, Threats 2 and 3 (treated as one push-abuse track):
 *  - the attacker's push overrides the victim's (Google/Duo on VoiceOver/TalkBack)
 *  - pushes carry no audible device details (Duo)
 *  - repeated prompts wear the user down until they approve
 *  - fixed expiry windows are too short for speech at the user's rate
 *
 * assess() is a pure function of the push, the account's push history and the
 * clock, so the phone UI, the server and the evaluation all share it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PushGuard = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULTS = {
    windowMs: 120000,        // look-back window for the fatigue detector
    burstThreshold: 3,       // this many pushes inside the window = fatigue pattern
    denyThreshold: 2,        // this many denials/timeouts inside the window = fatigue pattern
    cooldownMs: 300000,      // approvals stay locked this long after the last suspicious push
    concurrentWindowMs: 45000, // two pending pushes this close together = concurrent login
    baseExpiryMs: 60000,     // what deployed services typically allow
    actionBufferMs: 20000,   // time to find and press a button after listening
    wordsPerMinute: 180,     // speech-synthesis speed at rate 1.0 (screen reader default ~50%)
    knownDevices: [],        // devices the user has signed in from before
  };

  const DEFAULT_COMPONENTS = {
    context: true,      // announce service, device, location, age, request count
    codeWord: true,     // spoken session code word, also spoken on the computer
    concurrency: true,  // warn when more than one request is pending
    fatigue: true,      // burst/denial detector with approval lock
    adaptiveExpiry: true,
  };

  const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

  function speakDigits(s) { return String(s).split('').map((c) => DIGITS[+c] || c).join(' '); }

  function speechSeconds(text, rate, wpm) {
    const words = String(text).trim().split(/\s+/).filter(Boolean).length;
    return words / (((wpm || DEFAULTS.wordsPerMinute) * (rate || 1)) / 60);
  }

  function deviceLabel(d) { return d ? `${d.browser} on ${d.os}` : 'an unknown device'; }
  function deviceKey(d) { return d ? `${d.browser}|${d.os}|${d.location}` : ''; }

  function ago(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 5) return 'just now';
    if (s < 60) return `${s} seconds ago`;
    const m = Math.round(s / 60);
    return `${m} minute${m === 1 ? '' : 's'} ago`;
  }

  // What deployed push apps say (Google/Duo style, as observed in the paper).
  function baselineAnnouncement(push) {
    return `${push.service}. Are you trying to sign in? Approve. Deny.`;
  }

  function assess(push, allPushes, now, options, components) {
    const o = { ...DEFAULTS, ...(options || {}) };
    const c = { ...DEFAULT_COMPONENTS, ...(components || {}) };
    const sameAccount = (allPushes || []).filter((p) => p.account === push.account);
    const recent = sameAccount.filter((p) => p.createdAt <= now && now - p.createdAt <= o.windowMs);
    const pending = sameAccount.filter((p) => p.status === 'pending');
    const others = pending.filter((p) => p.id !== push.id &&
      Math.abs(p.createdAt - push.createdAt) <= o.concurrentWindowMs);
    const refused = recent.filter((p) => ['denied', 'reported', 'expired'].includes(p.status));
    const warnings = [];

    if (c.concurrency && others.length) {
      warnings.push({
        type: 'concurrent',
        level: 'danger',
        text: `Caution: ${others.length + 1} sign-in requests are waiting at the same time. Only one can be yours. ` +
          'Approve only the one whose code word matches your computer.',
      });
    }

    let locked = false;
    let lockedUntil = 0;
    if (c.fatigue && (recent.length >= o.burstThreshold || refused.length >= o.denyThreshold)) {
      const last = Math.max(...recent.map((p) => p.createdAt));
      lockedUntil = last + o.cooldownMs;
      locked = now < lockedUntil;
      warnings.push({
        type: 'fatigue',
        level: 'danger',
        text: `Warning: ${recent.length} sign-in requests in the last ${Math.round(o.windowMs / 60000)} minutes` +
          (refused.length ? `, and you refused ${refused.length}` : '') +
          '. Attackers send many requests to wear you down. Approve is locked for now. ' +
          'If you did not just sign in, choose Report.',
      });
    }

    if (c.context && o.knownDevices.length && !o.knownDevices.includes(deviceKey(push.device))) {
      warnings.push({
        type: 'new-device',
        level: 'warn',
        text: `This request comes from a device you have not used before.`,
      });
    }

    const index = pending.findIndex((p) => p.id === push.id);
    const parts = [];
    if (c.context) {
      parts.push(`Sign-in request${pending.length > 1 ? ` ${index + 1} of ${pending.length}` : ''} for ${push.service}.`);
      parts.push(`From ${deviceLabel(push.device)}, near ${push.device ? push.device.location : 'an unknown place'}, started ${ago(now - push.createdAt)}.`);
    } else {
      parts.push(`${push.service}. Are you trying to sign in?`);
    }
    if (c.codeWord && push.codeWord) parts.push(`Code word: ${push.codeWord}.`);
    for (const w of warnings) parts.push(w.text);
    if (!locked) parts.push(c.codeWord ? 'Approve only if you just signed in and the code word matches.' : 'Approve. Deny.');
    const announcement = parts.join(' ');

    const expiresMs = c.adaptiveExpiry
      ? Math.max(o.baseExpiryMs, Math.round(speechSeconds(announcement, o.rate, o.wordsPerMinute) * 1500 + o.actionBufferMs))
      : o.baseExpiryMs;

    return {
      announcement,
      warnings,
      level: warnings.some((w) => w.level === 'danger') ? 'danger' : warnings.length ? 'warn' : 'ok',
      locked,
      lockedUntil,
      expiresMs,
      pendingCount: pending.length,
    };
  }

  return {
    assess, baselineAnnouncement, speechSeconds, speakDigits, deviceKey, deviceLabel,
    DEFAULTS, DEFAULT_COMPONENTS,
  };
});
