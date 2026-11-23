# Fixes to VoiceGuard's spoken output — 23 November 2026

These changes came out of a blind-user test: the app was driven keyboard-only in a real browser,
twice (Baseline and VoiceGuard), and every announcement was recorded. Reading those recordings
turned up five things to fix. This document says what each one was, what changed, how it was
checked, and what it cost.

The recording itself is in [`blind-user-session/`](blind-user-session/).

---

## 1. The look-alike warning was spoken four times for one link

**Observed.** In the phishing task, the same long sentence was spoken four times:

```
Warning! Look-alike link. Confirm your identity. It goes to northwiindbank dot com,
not northwindbank dot com. It has a double I, as in India, after T, H, W. This is likely a phishing site.
Blocked. Warning! Look-alike link. It goes to northwiindbank dot com, not northwindbank dot com. …
Warning! Look-alike link. Confirm your identity. It goes to northwiindbank dot com, …
Warning! Look-alike link. Confirm your identity. It goes to northwiindbank dot com, …
```

**Why it matters.** This is the project's flagship feature, and it is the one message a
screen-reader user must not have to sit through four times. Each repetition is roughly eleven
seconds of speech. A participant who tabs back and forth over the link — which is exactly what
happens when the fake site is blocked — hears it again and again.

**Cause.** Three separate things repeated it:

1. `pc.html` spoke the full warning from the link's `focus` handler, every time the link took focus.
2. `showInterstitial()` spoke the full warning a second time as part of the "Blocked…" line.
3. The browser gives focus back to the link when the blocking dialog closes, and the link is rebuilt
   whenever the page re-renders — so the focus handler fired twice more on its own.

**Fix.**

- `public/pc.html:258` — the full warning is now spoken **once per link**. The existing `spokenLinks`
  set (which already stopped the warning being *logged* more than once) now also stops it being *spoken*
  more than once. Later focuses get a short reminder instead.
- `public/js/domain-guard.js:343` — new `announceLinkShort()`: *"Warning. Look-alike link. It goes to
  northwiindbank dot com, not northwindbank dot com."* It keeps the one thing that matters — which host
  the link really goes to — and drops the long difference description.
- `public/pc.html:114` — the blocking dialog now says *"Blocked. Look-alike website. Press Enter to go
  back to safety."* instead of repeating the whole warning. The dialog's visible text still carries the
  full detail, so anyone reading the page gets it.

**Checked by.** The re-recorded session, plus a new unit test
(`the short warning keeps the host difference and drops the long description`).

**Result.** One full warning, then short reminders. Four long sentences became one long and two short.

---

## 2. The brand-in-subdomain warning contradicted itself

**Observed.** For `contosopay.com.auth-check.site` the app said:

```
Warning! Look-alike link. It goes to auth dash check dot site, not contosopay dot com.
The real address is auth dash check dot site. The name contosopay is only put at the front to trick you.
```

**Why it matters.** "The real address is auth dash check dot site" calls the *attacker's* domain the
real address — one clause after saying "it goes to auth dash check dot site, **not** contosopay dot com".
A listener has no way to tell which of the two hosts the app just vouched for, and this is exactly the
kind of sentence a screen-reader user cannot re-read quickly. If they took it at face value, they would
be told that the phishing domain is genuine.

**Cause.** `describeDifference()` used `a.registrable` — the registrable domain of the **fake** URL —
in the "The real address is …" sentence. The trusted brand is `a.target`.

**Fix.** `public/js/domain-guard.js:314` — the brand-in-subdomain case no longer names a host at all:

```
Warning! Look-alike link. It goes to auth dash check dot site, not contosopay dot com.
The name contosopay is only put at the front of the address to trick you. This is likely a phishing site.
```

The real site is still named — once, in the "not …" clause, which is where it belongs. The same sentence
appears in `announcePage()` ("Danger. You are on auth dash check dot site, a look-alike of contosopay dot
com. The name contosopay is only put at the front of the address to trick you.").

**Checked by.** Two new unit tests: one for this attack type, and one that walks **every** attack type
and every trusted brand, asserting that no announcement ever calls the attacker's host "the real address".

**Cost.** This is the one fix that moved a headline number, and it is worth being explicit.

| Measure | Before | After |
|---|---|---|
| Mean spoken similarity, real vs fake (VoiceGuard) | 48.2% | **49.1%** |
| brand-in-subdomain similarity, VoiceGuard | 37.9% | **44.5%** |
| brand-in-subdomain similarity, today's screen reader | 57.8% | 57.8% (unchanged) |
| Time to hear the difference sentence | 4.1 s | **3.8 s** |
| Time to hear the brand-in-subdomain difference sentence | 7.0 s | **5.0 s** |

The similarity metric is TF-IDF cosine over character trigrams, and the old sentence earned its good
score partly by repeating the attacker's domain, which lengthened the announcement and diluted the
overlap. Removing it makes the announcement shorter and more accurate, and a shorter announcement
necessarily scores closer to the real site's short "Link. Goes to … Verified site." announcement.
VoiceGuard still separates this attack type from today's behaviour (44.5% against 57.8%), and the
difference sentence is now quicker to hear than spelling the whole address out (5.0 s versus 5.0 s).

Wordings were compared against the project's own metric before choosing, and the wording shipped is the
one that is true, unambiguous **and** keeps the difference sentence inside the "say only the difference"
budget. The alternative that scored best called the attacker's domain "the real address" — a false
statement — and another that scored nearly as well padded the sentence with a phrase that told the
listener nothing they did not already know. Correctness won over the word-overlap number; that is a
judgement call, and it is the one to overrule if the group prefers the old score.

---

## 3. The code word was spoken three times in one breath

**Observed.** On the computer:

```
Check your phone. Your code word is FALCON. Again: FALCON. Only approve a request that says FALCON.
This request comes from Chrome on Windows, near Karachi.
```

**Why it matters.** Saying the code word twice is deliberate — it has to be heard over noise, and the
app's own adaptive expiry is built on "time to hear the request twice". Saying it a third time inside
the instruction is not: it is the same word three times in four seconds.

**Fix.** `public/pc.html:345` — the instruction now refers to the code word instead of naming it again:

```
Check your phone. Your code word is FALCON. Again: FALCON. Only approve a request that carries that code word.
This request comes from Chrome on Windows, near Karachi.
```

The visible text on the page still shows the word in bold, where a participant can look at it.

**Checked by.** The re-recorded session.

---

## 4. The Baseline fatigue flow pushes the participant towards approving

**Observed.** In the Baseline condition, each refusal ends with the password step folded into the same
stream, and the next request arrives ten seconds later in exactly the same words:

```
Northwind Bank. Are you trying to sign in? Approve. Deny.
Denied. Secure your account. Change password.
Northwind Bank. Are you trying to sign in? Approve. Deny.
```

**Why it matters.** The participant in the recording resisted only because the policy it followed denies
any request that cannot be tied to a sign-in just made. A participant who acts on "Change password" and
then treats the next request as a continuation of that flow would approve it. The Baseline is not just
less safe here — it is actively misleading.

**Deliberately not changed.** The Baseline condition exists to reproduce what deployed services do
today, because that is the comparison the study is built on. The "change password" prompt blending into
the next push is a flaw found in the *Broken Access* paper, and the Baseline's job is to reproduce it
faithfully. Changing it would remove the finding rather than fix the code.

**What was done instead.** Documented, so no one mistakes it for a bug in VoiceGuard:

- `docs/RUNNING_THE_EXPERIMENT.md` — a note in the phone section telling the experimenter what to
  watch for and what to write down.
- `docs/blind-user-session/README.md` — recorded as an observation about the Baseline condition.

---

## 5. "A device you have not used before" was repeated on every spammed request

**Observed.** During the fatigue attack, every one of the six requests ended with:

```
… Code word: MARBLE. Warning: 3 sign-in requests in the last 2 minutes, and 2 refused or missed in the
last 10 minutes. Attackers send many requests to wear you down. Approve is locked for now. If you did not
just sign in, choose Report. This request comes from a device you have not used before.
```

**Why it matters.** Six requests from one attacker machine produced six "you have not used this device
before" warnings. The first one is useful; the fifth is noise, and it is the longest part of an already
long announcement — for a user who is meant to be under pressure.

**Cause.** The check asked "is this device unknown to me?" — which was true of every request, because the
*attacker's* machine was never seen. It never asked "have I seen it before?".

**Fix.** `public/js/push-guard.js:107` — the warning now fires only for a device that has not appeared
before in this account's history, so an attacker sending six requests from one machine is warned once.

**Checked by.** A new unit test (`the new-device warning is not repeated for a device already seen`),
and by re-running the evaluation: the ablation table still reports the new-device warning in 7 of 7
concurrent-login races, because each of those races is a separate first-time device.

---

## What changed in the numbers

| | Before | After |
|---|---|---|
| Unit tests | 13 passed | **17 passed** (4 added) |
| Mean spoken similarity, VoiceGuard | 48.2% | 49.1% |
| Mean time to hear the difference sentence | 4.1 s | 3.8 s |
| brand-in-subdomain time to hear the difference | 7.0 s | 5.0 s |
| Look-alike link warning, times spoken per link | up to 4 | **1 full + short reminders** |
| Code word, times spoken in one breath | 3 | **2** |
| "New device" warning per spammed device | every request | **once** |

Files touched:

```
VoiceGuard/public/js/domain-guard.js   wording of the brand-in-subdomain difference; new announceLinkShort()
VoiceGuard/public/js/push-guard.js     new-device warning fires once per device
VoiceGuard/public/pc.html               warning spoken once per link; dialog no longer repeats it; code word said twice
VoiceGuard/test/run-tests.js            4 new regression tests
VoiceGuard/eval/results/*               refreshed by npm run eval
```

Numbers quoted in the report were updated to match:

```
docs/final-report.md                    similarity table, listening time, the brand-in-subdomain example
docs/experimental-plan.md               same two tables
docs/MAKING_CHANGES.md                  now points here, and says to refresh quoted numbers
```

> **Still to do by hand:** `VoiceGuard/VoiceGuard_Final_Report.docx` is a Word copy of
> `docs/final-report.md` and has not been regenerated, so its tables still carry the old numbers
> (48.2%, 37.9%, 4.1 s) and the old brand-in-subdomain wording. Regenerate it from the markdown
> before circulating it.

## How to check these yourself

```bash
cd VoiceGuard
npm test        # 17 tests, including the four new regression tests
npm run eval    # refreshes eval/results/, which the Results page reads
```

Then run the app and open the Computer page in the VoiceGuard condition:

- Open a phishing email and press Tab onto the link — you should hear the full warning **once**, and
  only a short reminder if you tab back to it.
- Activate the link — the blocking dialog should say *"Blocked. Look-alike website."*, not repeat the
  warning, and the full text should still be in the dialog itself.
- Sign in — the code word should be spoken twice, not three times.
- Run the attacker console's push spam — the first request should mention the unfamiliar device, the
  rest should not.
