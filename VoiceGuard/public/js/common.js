/*
 * Shared client code: server connection, logging, and the speech layer that
 * stands in for a screen reader during the study.
 *
 * Voice modes (chosen per device, remembered in localStorage):
 *   tts  — built-in speech synthesis (for pilot participants without a screen reader)
 *   sr   — aria-live only, so the participant's own NVDA/JAWS/VoiceOver/TalkBack speaks
 *   both — both of the above
 *   off  — transcript only
 */
const VG = (() => {
  let state = null;
  let clockOffset = 0;
  const handlers = { state: [], event: [], command: [] };
  const page = document.body.dataset.page || 'unknown';

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* storage unavailable: use defaults */ }
    return null;
  }

  // ---------- server ----------
  async function api(path, body) {
    const res = await fetch(path, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }

  function log(type, data) {
    return api('/api/log', { type, page, ...(data || {}) }).catch(() => {});
  }

  function connect() {
    const es = new EventSource('/api/stream');
    es.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.kind === 'state') {
        state = msg.state;
        clockOffset = state.now - Date.now();
      }
      (handlers[msg.kind] || []).forEach((fn) => fn(msg[msg.kind] || msg));
    };
    es.onerror = () => setStatus('Reconnecting to the study server…');
    es.onopen = () => setStatus('');
  }

  function on(kind, fn) { handlers[kind].push(fn); }
  function now() { return Date.now() + clockOffset; }
  function guard(component) {
    return !!state && state.config.condition === 'guard' && state.config.components[component] !== false;
  }

  function setStatus(text) {
    const el = document.getElementById('conn-status');
    if (el) el.textContent = text;
  }

  // ---------- earcons ----------
  let audioCtx = null;
  function tone(freq, start, dur, type) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + start + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(audioCtx.currentTime + start);
    o.stop(audioCtx.currentTime + start + dur + 0.05);
  }
  function earcon(kind) {
    if (voiceMode() === 'off') return 0;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (kind === 'danger') { tone(880, 0, 0.18, 'square'); tone(440, 0.22, 0.3, 'square'); return 600; }
      if (kind === 'ok') { tone(523, 0, 0.12); tone(784, 0.13, 0.18); return 350; }
      tone(660, 0, 0.15);
      return 200;
    } catch (e) { return 0; }
  }

  // ---------- speech ----------
  function voiceMode() { return store('vg-voice') || 'tts'; }

  function transcript(text, level) {
    const box = document.getElementById('transcript');
    if (!box) return;
    const li = document.createElement('li');
    li.className = level || '';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    li.innerHTML = `<time>${time}</time> ${esc(text)}`;
    box.prepend(li);
    while (box.children.length > 40) box.lastChild.remove();
  }

  // interrupt: true  → stop whatever is being said and say this now
  // interrupt: false → say this after everything already queued
  const pendingTimers = new Set();

  function later(fn, ms) {
    const id = setTimeout(() => { pendingTimers.delete(id); fn(); }, ms);
    pendingTimers.add(id);
  }

  function announceLive(text, o) {
    // Interrupting messages go to the assertive region; queued ones are appended to the
    // polite region so the screen reader reads them in order instead of dropping earlier ones.
    const live = document.getElementById(o.interrupt && o.level === 'danger' ? 'live-assertive' : 'live-polite');
    if (!live) return;
    if (o.interrupt) live.textContent = '';
    later(() => {
      const p = document.createElement('p');
      p.textContent = text;
      live.appendChild(p);
      while (live.children.length > 6) live.firstChild.remove();
    }, 60);
  }

  function speak(text, opts) {
    const o = { interrupt: true, earcon: null, level: '', ...(opts || {}) };
    if (!text) return;
    if (o.interrupt) stopSpeech();
    transcript(text, o.level);
    const mode = voiceMode();
    const delay = o.earcon ? earcon(o.earcon) : 0;
    if (mode === 'sr' || mode === 'both') announceLive(text, o);
    if ((mode === 'tts' || mode === 'both') && 'speechSynthesis' in window) {
      // Chrome's voices stop after roughly 15 s of continuous speech, so long
      // announcements are queued sentence by sentence.
      const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
      later(() => {
        for (const s of sentences) {
          if (!s.trim()) continue;
          const u = new SpeechSynthesisUtterance(s.trim());
          u.rate = state ? state.config.speechRate : 1;
          u.lang = 'en-US';
          speechSynthesis.speak(u);
        }
      }, delay);
    }
  }

  function stopSpeech() {
    for (const id of pendingTimers) clearTimeout(id);
    pendingTimers.clear();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Header controls shared by every page: voice mode picker + "start audio" gate.
  function mountVoiceControls() {
    const sel = document.getElementById('voice-mode');
    if (sel) {
      sel.value = voiceMode();
      sel.addEventListener('change', () => { store('vg-voice', sel.value); speak(`Voice mode: ${sel.selectedOptions[0].text}`); });
    }
    const gate = document.getElementById('audio-gate');
    if (gate) {
      const btn = gate.querySelector('button');
      btn.addEventListener('click', () => {
        gate.hidden = true;
        earcon('ok');
        speak(gate.dataset.welcome || 'Audio is on.');
        document.dispatchEvent(new Event('vg-audio-ready'));
      });
      btn.focus();
    }
  }

  document.addEventListener('DOMContentLoaded', () => { mountVoiceControls(); connect(); });

  return { api, log, on, now, guard, speak, stopSpeech, earcon, esc, get state() { return state; }, page };
})();
