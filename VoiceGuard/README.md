# VoiceGuard

VoiceGuard is screen-reader-aware protection against the three attacks we chose from *Broken Access* (WWW '25): **phishing**, **concurrent login** and **push-notification fatigue**. It is a working prototype plus a study harness for testing it against the behaviour of today's screen readers.

## The problem, in one line each

| Problem (our report) | What the paper observed | What VoiceGuard does |
|---|---|---|
| 1. Phishing | `bankofamerica.com` and `bankoffamerica.com` sound identical (100% similarity). Spelling a URL letter by letter is slow and easy to defeat. | Finds the closest trusted site and **speaks only the difference** using the NATO alphabet ("a double F, as in Foxtrot, after N, K, O"). Catches homoglyphs (including Unicode/punycode), TLD swaps, brand-in-subdomain, combosquats and the `user@host` trick. Announces the real domain on every page load and **blocks** look-alikes with an accessible interstitial. |
| 2. Concurrent login | The attacker's push **overrides** the victim's (Google, Duo), with no device details (Duo). | Pushes are **never hidden**: every pending request stays listed. Each one is spoken with service, device, city and age, plus a **code word** that the computer also speaks. A concurrency alert says "2 requests are waiting, only one can be yours". |
| 3. Notification fatigue | Repeated prompts wear users down. Microsoft collapses to approve/deny, and after a denial Google sends the user to a "change password" step that blends into the next prompt. | Detects bursts (3 or more requests in 2 minutes) and slow drips (2 or more refused or missed in 10 minutes). It then **locks Approve** for a cool-down, explains why, and offers **Report**. |
| (all) Time pressure | Comprehensibility collapses at faster speech rates. Expiry windows are fixed. | **Adaptive expiry**: there is always time to hear the request twice plus 30 s. A "15 seconds left" cue is spoken. |

Each component can be switched off on its own (ablation) from the experimenter page.

## Running it

Requires Node 18 or newer. There is nothing to install.

```bash
cd VoiceGuard
npm start
```

Open http://localhost:3000. The page you land on links to:

| Page | Role |
|---|---|
| `/pc.html` | Participant's computer: mail, bank sign-in, and spoken output |
| `/phone.html` | Participant's phone: push approvals. In VoiceGuard mode every waiting request is listed under its own heading, new requests are queued (never cut off), and **Read all waiting requests**, **Repeat this request** and **Stop reading** let the user re-hear them. Open it on a real phone on the same Wi-Fi (the server prints the address) to use VoiceOver or TalkBack. |
| `/attacker.html` | Send look-alike emails, arm a concurrent-login race, spam pushes |
| `/study.html` | Experimenter: participant ID, AB/BA counterbalancing, 6 scripted tasks per block, SUS and NASA-TLX, CSV export |
| `/results.html` | Automated evaluation and study results, baseline against VoiceGuard |

**Voice modes** (top right of the computer and phone): *Built-in voice* uses speech synthesis, for pilot participants. *My screen reader* posts to ARIA live regions so NVDA, JAWS, VoiceOver or TalkBack speak instead. *Both*, or *Silent*.

**Baseline condition** reproduces today's behaviour from the paper. Links are read as whole words, the newest push replaces the older one, the push has no details, and a denial leads to a "change password" prompt. **VoiceGuard condition** turns on the protections above.

## Tests and evaluation

```bash
npm test        # unit tests for both guards
npm run eval    # automated evaluation → eval/results/
```

Headline results (`eval/results/phishing_results.md`, `push_results.md`):

- **99.6%** of 1,114 generated look-alikes of 50 real brands are detected, and the correct real site is named. There are **0** false alarms on 85 legitimate sites that are not on the trusted list.
- The paper's pairs (`bankoffamerica`, `wellssfargo`) score **100% → about 60%** spoken similarity (TF-IDF cosine, the paper's metric). Every repetition and Unicode-homoglyph attack sounds identical today. With VoiceGuard none does.
- Concurrent login: in every simulated race the baseline phone shows only the attacker's push. VoiceGuard shows both and warns. When the attacker spoofs the victim's device and city, only the code word still tells them apart.
- Fatigue: warned and locked by the 3rd push for intervals from 5 s to 5 min. Known limit: one push every 15 minutes or more is not detected.

## Study data

Everything is logged to `data/` (git-ignored; start with `DATA_DIR=data/practice npm start` to keep practice runs separate): `events.jsonl`, `results.jsonl` (one auto-scored row per task) and `questionnaires.jsonl`. Download them as CSV from the experimenter page.

Step-by-step guides for the group are in [`../docs/`](../docs/): running the app, running the experiment, and making changes.

## Layout

```
server.js                  zero-dependency HTTP + Server-Sent Events server, task scripting and scoring
public/js/domain-guard.js  look-alike detection, punycode, phonetic difference announcements, look-alike generator
public/js/push-guard.js    concurrency / fatigue detection, context announcements, adaptive expiry
public/js/common.js        speech layer (TTS / ARIA live), earcons, server connection
public/*.html              computer, phone, attacker, experimenter, results pages
eval/                      phishing-eval.js, push-eval.js and their results
test/run-tests.js          unit tests
```

Only fictional brands (Northwind Bank, Contoso Pay, Fabrikam Bank, Tailspin Pay) appear in the study pages. Real brand names appear only as strings in the offline evaluation.
