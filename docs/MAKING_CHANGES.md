# Making changes to VoiceGuard

This guide explains where things live in the code, how to change the most common things safely, and how to share your changes with the group.

## 1. How the app is built

VoiceGuard is plain JavaScript with no frameworks and no extra packages.

- A small **server** (`server.js`) keeps the shared state: the victim's inbox, push requests, sign-ins and the running study task. It sends live updates to every open page.
- The **pages** in `public/` are plain HTML files, each with its own script.
- Two **guard** files hold the actual protection logic. Both the server and the pages use them.

```
VoiceGuard/
├── server.js                  server: state, attacks, study tasks, scoring, logging
├── package.json               npm start / npm test / npm run eval
├── public/
│   ├── index.html             home page
│   ├── pc.html                participant's computer (mail, bank, browser speech)
│   ├── phone.html             participant's phone (push approvals)
│   ├── attacker.html          attacker console
│   ├── study.html             experimenter console
│   ├── results.html           results dashboard
│   ├── css/style.css          all styling and colours
│   └── js/
│       ├── domain-guard.js    phishing: fake-domain detection and spoken warnings
│       ├── push-guard.js      concurrent login + fatigue: detection, announcements, expiry
│       └── common.js          speech (voice / screen reader), sounds, server connection
├── eval/                      automated evaluation scripts and their results
├── test/run-tests.js          unit tests
└── data/                      study logs (created when the app runs, never committed)
```

## 2. After you change something

| You changed | What to do |
|---|---|
| A page (`.html`), `style.css` or `common.js` | Reload the page in the browser |
| `server.js`, `domain-guard.js` or `push-guard.js` | Stop the app (Ctrl + C), run `npm start`, then reload the pages |

Then check nothing broke:

```bash
npm test
```

If you changed `domain-guard.js` or `push-guard.js`, also refresh the evaluation numbers (the Results page and the report use them):

```bash
npm run eval
```

## 3. Common changes

### Change brands, trusted sites, emails or tasks — `server.js` (top of the file)

| What | Name in the file | Example |
|---|---|---|
| Fictional brands for block 1 and block 2 | `BRAND_SETS` | Rename "Northwind Bank" or change its domain. Brands listed here are trusted automatically. |
| Other trusted sites | `TRUSTED` | Add `'hbl.com'` |
| Code words spoken on the computer and phone | `CODE_WORDS` | Use shorter or Urdu words |
| Victim and attacker device details | `VICTIM_DEVICE`, `ATTACKER_DEVICE` | Change the city |
| Task instructions read to participants | `TASKS` | Edit each `instruction` |
| Normal "filler" emails | `BACKGROUND_MAIL` | Add more emails |
| Phishing emails used in the study, and the trick each uses | function `phishingEmail` | Change `'repetition'` to `'homoglyph'` |
| Timing of the scripted attacks | function `startTask` | Concurrent delay `2500` ms; fatigue `count: 6, intervalMs: 10000` |
| How each task is scored | function `scoreTask` | |

Suggested time limits shown to the experimenter are in `public/study.html` (`LIMIT_S`).

### Change the push rules — `public/js/push-guard.js` (`DEFAULTS` at the top)

| Setting | Default | Meaning |
|---|---|---|
| `burstThreshold`, `windowMs` | 3, 2 minutes | This many requests in this time counts as spam |
| `denyThreshold`, `denyWindowMs` | 2, 10 minutes | This many refused or missed requests counts as spam |
| `cooldownMs` | 5 minutes | How long Approve stays locked |
| `concurrentWindowMs` | 5 minutes | Two waiting requests this close together trigger the warning |
| `baseExpiryMs` | 60 seconds | Shortest time before a request expires |
| `actionBufferMs` | 30 seconds | Extra time added after hearing the request twice |
| `wordsPerMinute` | 180 | Speech speed used to estimate listening time |

What the phone says for each request is built in the `assess()` function in the same file. What the baseline phone says is in `baselineAnnouncement()`.

### Change phishing detection or its wording — `public/js/domain-guard.js`

| What | Where |
|---|---|
| Wording of warnings | `describeOp`, `describeDifference`, `announceLink`, `announcePage` |
| How strict typo matching is | `maxDistanceFor` (names under 4 letters: 0 changes allowed, 4–8 letters: 1, longer: 2) |
| Look-alike characters | `UNICODE_CONFUSABLES`, `ASCII_CONFUSABLES` |
| Country endings like `com.pk` | `MULTI_PART_SUFFIXES` |
| Tricks the attacker console can generate | `makeLookalike` and `ATTACK_TYPES` |

### Change how the phone or computer behaves — `public/phone.html`, `public/pc.html`

Each page's logic is in the `<script>` block at the bottom of the file. For example, the "Read all waiting requests" button is in `phone.html` (`readAll`), and the blocking page for fake sites is in `pc.html` (`showInterstitial`).

### Change colours or layout — `public/css/style.css`

Colours are variables at the top of the file (`--accent`, `--danger` and so on), with a separate dark-mode set below them.

### Change the evaluation — `eval/phishing-eval.js`, `eval/push-eval.js`

`TRUSTED` is the list of 50 brands that fakes are generated from, and `LEGIT_OTHERS` is the list of real sites used to check for false alarms.

## 4. Settings you can change without editing code

| Setting | How |
|---|---|
| Baseline or VoiceGuard, speech rate, individual protections on or off | Experimenter page → **Advanced** |
| Port | `PORT=3001 npm start` |
| Where study data is saved | `DATA_DIR=data/practice npm start` saves logs into `data/practice/` instead of `data/`. Useful for keeping practice runs separate from real sessions. |

## 5. Sharing your changes with the group

Always start from the latest version so you don't overwrite someone else's work:

```bash
git pull
```

Make your change, run `npm test`, then:

```bash
git add -A
git commit -m "Short description of what you changed"
git push
```

If `git push` is rejected because someone else pushed first, run `git pull`, check the app still works, and push again. If Git reports a **conflict**, two people edited the same lines. Open the file, keep the right version between the `<<<<<<<` and `>>>>>>>` markers, delete the markers, then `git add -A`, `git commit` and `git push`.

To avoid conflicts, tell the group which file you are working on, and keep commits small.

### Rules of thumb

- Never commit the `data/` folder. It holds participant data and is ignored by Git on purpose.
- Keep fictional brand names in anything participants see.
- If you change the guards, re-run `npm run eval` and update any numbers you quote in the report.
