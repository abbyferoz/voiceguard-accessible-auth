# Blind-user session recording — VoiceGuard

Two recorded sessions of VoiceGuard driven **keyboard-only**, in a real browser, exactly as a
screen-reader user would experience them. One in **Baseline** (today's behaviour) and one in
**VoiceGuard** (protections on), so the three fixes can be checked against real output rather
than against the source code alone.

| File | What it is |
|---|---|
| `transcript-baseline.md` | Every line the app said in the Baseline condition |
| `transcript-voiceguard.md` | Every line the app said in the VoiceGuard condition |
| `raw-session-baseline.json` | Machine-readable capture (announcements, focus log, actions, scores) |
| `raw-session-voiceguard.json` | Machine-readable capture |
| `harness/run-session.js` | The driver, so the recording can be repeated |

## Method

- **Real browser.** Chrome for Testing 156 (headless), driven by Playwright. The app's own page
  scripts ran unmodified — these transcripts are the app's output, not a re-implementation.
- **Keyboard only.** Every action was `Tab` / `Enter` / typing. No clicking by position, no reading
  the screen to decide what to do.
- **Voice mode "My screen reader."** Announcements were posted to the ARIA live regions, which is
  exactly what NVDA, JAWS, VoiceOver or TalkBack would read. The audio itself was not rendered to
  sound — the *text* the screen reader would speak is what is recorded.
- **Where the text comes from.** Each line was read out of the app's own "Spoken output" panel
  (`#transcript`), captured with a `MutationObserver` so nothing was lost to the 40-line cap.
  Focus movement was logged separately, since that is what a screen reader announces about a control.
- **Scoring** was done by the app itself (`POST /api/task/end`), not by the harness.
- **Isolation.** The sessions ran against a separate instance on port 3100 with
  `DATA_DIR=data/blind-user-test`, so the real `data/study` participant data was not touched.

The participant was a **scripted synthetic user** with one consistent policy:

> Approve a request only if it can be tied to a sign-in just made on the computer; otherwise deny
> it. In VoiceGuard, approval additionally requires the code word to match the one the computer spoke.

Brand set A (Northwind Bank, Contoso Pay) and the same task order were used in both conditions so
the transcripts can be compared line by line.

## Are the three fixes actually working?

Yes — all three are confirmed in the recorded output, and all three were absent in the Baseline run.

### 1. Fake websites — say only the difference, and block the page

**Baseline** — the fake address is read like any other link, and the fake page sounds exactly like
the real one:

> "Link. Confirm your identity. northwiindbank dot com"
> "Northwind Bank. Sign in. Heading level 1."

The real site reads `northwindbank dot com`. Nothing in the audio distinguishes them, so the
participant followed the link, typed the password and approved the attacker's push
(`attack_success`, detail `opened_link;submitted_credentials;approved_relay_push`).

**VoiceGuard** — the difference is announced, and the page is blocked:

> "Warning! Look-alike link. Confirm your identity. It goes to northwiindbank dot com, not
> northwindbank dot com. It has a double I, as in India, after T, H, W. This is likely a phishing site."
> "Blocked. Look-alike website. Press Enter to go back to safety."
> "You stayed safe. Back on the previous page."

The full warning is heard **once**. The dialog no longer repeats it, and tabbing back to the link
gives a one-line reminder instead of the whole sentence.

Outcome `resisted`, detail `went_back_from_warning;reported`.

For the paper's own pair the wording is exactly as described. Checked against the shipped guard
module (`public/js/domain-guard.js`):

| URL | Baseline reading | VoiceGuard announcement |
|---|---|---|
| `bankoffamerica.com` | `bankoffamerica dot com` | "It has a double F, as in Foxtrot, after N, K, O." |
| `wellssfargo.com` | `wellssfargo dot com` | "It has a double S, as in Sierra, after E, L, L." |
| `contosopay.com.auth-check.site` | `contosopay dot com dot auth dash check dot site` | "The name contosopay is only put at the front to trick you." |

### 2. Attacker sign-in at the same time — every request stays visible, each with a code word

**Baseline** — the attacker's request replaced the victim's, so exactly one request was ever read
out, with no device, city or age:

> "Northwind Bank. Are you trying to sign in? Approve. Deny."

The participant approved it — the attacker's — because there was nothing to tell it apart from
their own sign-in. Outcome `attack_success`, detail `approved_attacker`.

**VoiceGuard** — both requests are listed, each with its own code word, and the computer states
which one is theirs:

> **PC**: "Check your phone. Your code word is COFFEE. Again: COFFEE. Only approve a request that
> carries that code word. This request comes from Chrome on Windows, near Karachi."
> **PHONE**: "Sign-in request for Northwind Bank. From Chrome on Windows, near Karachi, started
> just now. Code word: COFFEE. Approve only if you just signed in and the code word matches."
> **PHONE**: "Sign-in request 2 of 2 for Northwind Bank. From Chrome on Windows, near Karachi,
> started just now. Code word: RIVER. Caution: 2 sign-in requests are waiting at the same time.
> Only one can be yours. Approve only the one whose code word matches your computer."

The participant approved the `COFFEE` request (their own) and reported the `RIVER` one.
Outcome `resisted`, detail `approved_own;reported`.

Note that the attacker here spoofs the victim's device *and* city, so device and location are
identical on both cards — the code word is the only thing that separates them. That is the case the
`README.md` describes, and it held.

### 3. Request spamming — detect the spam and lock Approve

**Baseline** — nothing changes from one request to the next, and the denial message folds the
"change password" step into the same stream, so the next request is indistinguishable from it:

> "Northwind Bank. Are you trying to sign in? Approve. Deny."
> "Denied. Secure your account. Change password."
> "Northwind Bank. Are you trying to sign in? Approve. Deny."   ← ten seconds later, identical

**VoiceGuard** — from the third request the burst is detected, Approve is locked, and the reason is
explained:

> "Warning: 3 sign-in requests in the last 2 minutes, and 2 refused or missed in the last 10
> minutes. Attackers send many requests to wear you down. Approve is locked for now. If you did not
> just sign in, choose Report."

Pressing Approve afterwards is refused, with an explanation rather than a dead button:

> "Approve is locked because of too many requests. If you are signing in yourself, wait a few
> minutes and try again. If not, choose Report."

## Side-by-side outcomes

| Task | Baseline | VoiceGuard |
|---|---|---|
| `legit_email` | `legit_success` | `legit_success` |
| `legit_login` | `legit_success` | `legit_success` |
| `phish_typo` | **attack_success** | `resisted` |
| `phish_subdomain` | **attack_success** | `resisted` |
| `concurrent` | **attack_success** | `resisted` |
| `fatigue` | `resisted` | `resisted` |

Both legitimate sign-ins still succeed under VoiceGuard, so the protections are not blocking normal
use — the only thing that changed between the two columns is the three attack tasks.

## Before and after the fixes

These transcripts were recorded **twice**: once against the app as it was, and once after the five
issues below were fixed. The task outcomes are identical — the fixes change what the participant
hears, not whether the protections work.

| In the VoiceGuard condition | Before | After |
|---|---|---|
| Look-alike warning, times spoken per link | up to 4 (all full length) | 1 full, then one-line reminders |
| Blocking dialog says | "Blocked. Warning! Look-alike link. It goes to …" | "Blocked. Look-alike website." |
| brand-in-subdomain announcement | "…not contosopay dot com. **The real address is auth dash check dot site.**…" | "…not contosopay dot com. The name contosopay is only put at the front of the address to trick you." |
| Code word on the computer | "…says FALCON." (named three times) | "…carries that code word." (named twice) |
| "Device you have not used before" | on all 6 spammed requests | on the first one only |

The transcripts in this folder are the **after** version. What changed in the code, and the one
headline number it cost, is written up in [`../FIXES.md`](../FIXES.md).

## Things worth fixing

Found while reading the recordings. **All five have now been fixed** — see
[`../FIXES.md`](../FIXES.md) for what changed, how it was checked, and what it cost.

1. ~~**The phishing warning is spoken three times** for one link: once when focus lands on the link,
   again when the interstitial opens, and a third time when the participant returns to the page.
   A screen-reader user hears the same long sentence three times.~~ **Fixed** — the full warning is
   spoken once per link; later focuses get a one-line reminder, and the blocking dialog no longer
   repeats it.
2. ~~**The brand-in-subdomain wording contradicts itself.** It says "It goes to auth dash check dot
   site, not contosopay dot com. The real address is auth dash check dot site." — the second
   sentence calls the *attacker's* domain "the real address", one clause after saying it is not the
   real one. The safe site is named only in the "not …" clause.~~ **Fixed** — the sentence that named
   the attacker's host is gone; the real site is named once, in the "not …" clause.
3. ~~**The code word is spoken three times** in one breath ("Your code word is FALCON. Again: FALCON.
   Only approve a request that says FALCON."). Repeating it twice is deliberate and helps in noise,
   but the third occurrence inside the instruction is redundant.~~ **Fixed** — the code word is said
   twice, as intended, and the instruction no longer names it a third time.
4. ~~**The baseline fatigue flow nudges the user towards approving.** The denial message ends with
   "Secure your account. Change password.", and the next request arrives in the same place ten
   seconds later. The participant resisted only because the policy in this recording denies any
   request that cannot be tied to a sign-in just made. A user who acts on the change-password step
   and then treats the next request as a continuation would approve it. The baseline is not merely
   less safe here — it is actively misleading.~~ **Not changed, on purpose** — the Baseline reproduces
   the flaw the paper found, and that is what makes the comparison meaningful. It is now documented
   for experimenters in `docs/RUNNING_THE_EXPERIMENT.md`.
5. ~~**"New device" warnings fire on every fatigue request** ("This request comes from a device you
   have not used before"), because each spammed request is treated as a separate first-time device.
   Correct per request, but it makes the fatigue announcement long enough to be tiring to listen to.~~
   **Fixed** — the warning now fires once per device, so six requests from one attacker machine
   produce one warning.

## Reproducing

```bash
cd VoiceGuard
PORT=3100 HTTPS_PORT=3444 DATA_DIR=data/blind-user-test node server.js &
cd <this folder>/harness
npm i playwright          # any Chromium works; the harness takes CHROME_EXE as an override
node run-session.js baseline P01 ../raw-session-baseline.json
node run-session.js guard    P02 ../raw-session-voiceguard.json
```

## Caveats

- The participant is a **scripted synthetic user, not a human with a real screen reader**. It
  follows a fixed policy. It cannot show whether a *person* finds the announcements easy to
  understand, or whether the code-word matching is realistic to do in your head.
- No audio was rendered, so speech timing, interruptions and the "15 seconds left" cue were not
  exercised. Announcements were read as text.
- The decision times in the summary tables are machine timings, not human listening times.
- One participant per condition. These are engineering checks, not study results — they confirm the
  mechanisms fire and that the user-facing wording is what it claims to be.
