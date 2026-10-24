---
title: "VoiceGuard: Experimental Plan"
subtitle: "Testing screen-reader-aware defences against phishing, concurrent-login and push-fatigue attacks"
---

**Course:** Human-Computer Interaction, IBA, Fall 2026

**Paper extended:** Akanda, Mahdad, Saxena. *Broken Access: On the Challenges of Screen Reader Assisted Two-Factor and Passwordless Authentication.* ACM Web Conference (WWW '25).

| Name | Roll No. |
|---|---|
| Qazi Muhammad Waiz | 28982 |
| Haris Shibli | 28988 |
| Abdullah Feroz | 29219 |

# 1. What we are doing

Our report chose three problems from *Broken Access*:

1. **Phishing.** Screen readers read look-alike domains as whole words, so `bankofamerica.com` and `bankoffamerica.com` sound identical (100% similarity in the paper).
2. **Concurrent login.** The attacker's push notification overrides the victim's (Google Push on VoiceOver and TalkBack, Duo Push), and Duo shows no attacker device details.
3. **Notification fatigue.** Repeated push prompts wear the user down until they approve.

The paper stops at diagnosis. In one paragraph of its discussion it *recommends* a phishing URL detector inside the screen reader, clear announcement of the requesting service, a detector for multiple similar notifications, and expiry windows long enough for speech. It builds and tests none of them.

## 1.1 Our addition

We built **VoiceGuard**, a working, screen-reader-aware security layer that implements those recommendations, and a study harness to measure it against today's behaviour. Its new elements are:

| Problem | VoiceGuard mechanism | What is new compared with the paper |
|---|---|---|
| Phishing | **Phonetic difference announcement.** Find the closest trusted domain, compute the exact edit, and speak only that edit in the NATO alphabet: "It has a double F, as in Foxtrot, after N, K, O". The real domain is announced on every page load, and a blocking interstitial appears before a look-alike loads. | The paper's only fallback is manual letter-by-letter checking, which it calls slow and easy to defeat. We make the *difference* audible. We also cover nine techniques: repetition, omission, transposition, substitution, ASCII homoglyph, Unicode/punycode homoglyph, TLD swap, combosquat and brand-in-subdomain, plus the `user@host` trick. |
| Concurrent login | **No-override push list, context announcement and spoken code word.** Every pending request stays on screen. Each is read with service, device, city and age. The computer and the phone both speak a one-word code. A concurrency alert says "2 requests are waiting, only one can be yours". | The paper found that device and city can be spoofed. A code word that is spoken on both devices still separates the attacker's request when everything else matches. |
| Notification fatigue | **Burst and slow-drip detector with an approval lock.** Three or more requests in 2 minutes, or two or more refused or missed in 10 minutes, triggers a spoken warning, locks Approve for a cool-down, and offers Report. | This turns the paper's "multiple notification detector" idea into explicit, testable rules. |
| All three | **Adaptive expiry.** The window is never shorter than the time to hear the request twice plus 30 s, and a "15 seconds left" cue is spoken. | It answers the paper's finding that comprehension collapses at faster speech rates. |

Our report suggested treating concurrent login and fatigue as **one push-abuse track** because they overlap. VoiceGuard does that: one push guard handles both.

## 1.2 Deliverables

1. **A running application** (`VoiceGuard/`). It contains a simulated participant computer (mail, bank sign-in, browser speech) and a simulated phone (push approvals) that also runs on a real phone with VoiceOver or TalkBack. It also has an attacker console, an experimenter console with scripted and auto-scored tasks, and a results dashboard. Each VoiceGuard component can be switched off on its own for ablation.
2. **This experimental plan.**
3. **Phase 1 results**, already obtained, in Section 3.

# 2. Research questions and hypotheses

| | Research question | Hypothesis |
|---|---|---|
| RQ1 | Does VoiceGuard reduce phishing success for screen-reader users? | **H1:** Fewer participants submit credentials on a look-alike site with VoiceGuard than with the baseline. |
| RQ2 | Does VoiceGuard reduce approval of a concurrent attacker push? | **H2:** The attacker-approval rate is lower with VoiceGuard. |
| RQ3 | Does VoiceGuard reduce acceptance under push fatigue? | **H3:** Fewer participants approve any spam push with VoiceGuard. Those who do approve take more pushes to reach that point. |
| RQ4 | What does the protection cost in usability? | **H4:** Legitimate sign-in success is not lower, time to sign in rises by no more than 20%, SUS stays at or above 68 (average usability), and NASA-TLX workload is not higher. |
| RQ5 | Does VoiceGuard make attacks *audibly distinguishable* (AWARE comprehensibility)? | **H5:** The spoken similarity between real and spoofed links drops well below the paper's 100%. |

# 3. Phase 1: automated evaluation (no participants), completed

AWARE is a semi-automated precursor to user studies, so we first evaluated VoiceGuard the same way. Run it with `npm run eval`. Outputs are in `VoiceGuard/eval/results/`.

## 3.1 Method

- **Stimuli.** We took 50 real, frequently phished brands (global banks and services, plus Pakistani ones such as HBL, Meezan Bank, JazzCash and Easypaisa). For each one we generated up to three look-alikes per technique, giving **1,114** look-alikes in total. As negatives we used **85** legitimate sites that are not on the trusted list.
- **Detection.** A look-alike counts as detected if VoiceGuard flags it *and* names the right real site. A legitimate site that gets flagged counts as a false alarm.
- **Audible similarity (the paper's metric).** We render what the listener hears, in two ways. The *baseline* is the domain read as whole words, the way screen readers do it. *VoiceGuard* is our spoken announcement. Both are phonetically normalised so that spellings a speech engine pronounces alike match (doubled letters, c/k, ph/f, Unicode look-alikes). We then compute TF-IDF cosine similarity between the real and fake versions over character trigrams, as the paper did.
- **Listening cost.** Speaking time at 180 words per minute for VoiceGuard's difference sentence, compared with spelling the whole address character by character.

## 3.2 Results

| Measure | Result |
|---|---|
| Look-alikes detected (right real site named) | **99.6%** (1,110 / 1,114) |
| False alarms on legitimate sites | **0%** (0 / 85) |
| Paper's pair `bankofamerica` / `bankoffamerica`: spoken similarity | **100% today → 60.4% with VoiceGuard** |
| Paper's pair `wellsfargo` / `wellssfargo` | **100% → 59.5%** |
| Look-alikes that sound *identical* today | 21.4% overall: 98% of repetition and 100% of Unicode homoglyph attacks |
| Look-alikes that sound identical with VoiceGuard | 0% |
| Mean spoken similarity, all techniques | 68.8% today → 48.2% with VoiceGuard |
| Listening time | 4.1 s for VoiceGuard's difference sentence (10.6 s for the full warning) vs 5.0 s to spell the address. Spelling still leaves the user to compare from memory. |

| Technique | Detected | Similarity today | Similarity with VoiceGuard |
|---|---|---|---|
| Repetition (`bankoffamerica`) | 99.2% | 99.4% | 53.5% |
| Omission | 99.2% | 60.7% | 45.5% |
| Transposition | 100% | 46.8% | 45.3% |
| Substitution | 98.6% | 52.9% | 41.7% |
| ASCII homoglyph (`paypa1`) | 100% | 53.1% | 52.7% |
| Unicode homoglyph (`pаypal`, Cyrillic а) | 100% | 100% | 54.5% |
| TLD swap | 100% | 77.9% | 51.3% |
| Combosquat (`paypal-login`) | 100% | 73.1% | 55.5% |
| Brand in subdomain | 98.0% | 57.8% | 37.5% |

**Push-abuse checks.** We replayed attack schedules through the push guard, and all 8 checks pass:

- In every concurrent race from 0 to 60 s, the baseline phone shows only the attacker's push. VoiceGuard shows both pushes and warns.
- When the attacker spoofs the victim's browser, OS and city, the context details alone cannot tell the pushes apart, but the code word can.
- Fatigue: the warning and Approve lock arrive by the 3rd push at intervals from 5 s to 5 min, whether the user denies the pushes or ignores them.
- A normal single sign-in, or a retry after a timeout, produces no warning.
- **Known limit:** a very slow drip of one push every 15 minutes is not detected.

**Adaptive expiry.** The VoiceGuard announcement takes 19 s at the default rate. The expiry window grows to 68 s at rate 1.0 and to 81 s at rate 0.75. It never drops below the 60 s used by deployed services.

## 3.3 Phase 1b: replication with real screen readers (before Phase 2)

The numbers above use a modelled reading of speech. To match AWARE exactly, we will repeat the comprehensibility step with **real screen readers**:

- NVDA and JAWS on Windows 11, VoiceOver on iOS, TalkBack on Android.
- For each, record the audio while it reads the baseline and the VoiceGuard versions of 20 sampled look-alike links and of the push screens.
- Transcribe the audio with a speech-to-text engine (Whisper, in place of the paper's IBM Watson) and compute TF-IDF cosine similarity against the source text.
- Record the five communicability failures the paper defined (CBI, NPO, UCO, UCSP, UCEOB) for each screen.
- Repeat at the default speech rate and at 1.5× to check the paper's speech-rate finding.

# 4. Phase 2: pilot study

- **Participants:** 6–8 sighted students, blindfolded, using the app's built-in voice.
- **Purpose:** check task wording, timing, logging, auto-scoring and the cover story. Pilot data is **not** used to test hypotheses, because blindfolded sighted people are not a substitute for experienced screen-reader users.
- **Exit criteria:** every task finishes within its time limit, there are no logging gaps, and the experimenter script runs without improvisation.

# 5. Phase 3: main study with blind and visually impaired users

## 5.1 Participants

- **Target:** 20 participants, minimum 12. If we get fewer than 20 we report results as exploratory (see Section 8).
- **Inclusion:** aged 18 or over; blind or with low vision; uses a screen reader daily for at least a year; uses a smartphone screen reader (VoiceOver or TalkBack).
- **Recruitment:** IBA's disability support office and Karachi organisations that support blind and visually impaired people, with snowball referrals. All recruitment material will be in accessible formats.
- **Compensation:** a fixed honorarium plus travel, paid whether or not the participant finishes.

## 5.2 Design

A **within-subjects** design with one main independent variable, **Condition** (Baseline vs VoiceGuard), presented in two blocks.

- **Counterbalancing (AB/BA):** odd-numbered participants do Baseline first, even-numbered do VoiceGuard first. The study page assigns this automatically.
- **Separate stimuli per block** to stop learning carrying over. Block 1 always uses brand set A (Northwind Bank, Contoso Pay) and block 2 uses brand set B (Fabrikam Bank, Tailspin Pay), so brand set is balanced against condition through the order.
- **Task order** within each block is randomised with a seed derived from participant ID and block, so it is reproducible.
- **Embedded attacks with partial deception.** Participants are told the study is about "how easy it is to sign in with a screen reader". They are not told attacks will happen, because forewarning inflates vigilance. Everyone receives a full debrief at the end.

**Tasks per block (6), scripted and auto-scored by the app:**

| Task | Type | What happens | Attack succeeds if |
|---|---|---|---|
| legit_email | Legitimate | Statement email from the real bank, then sign in | — (success = signed in) |
| legit_login | Legitimate | Sign in to the payment app from a bookmark | — |
| phish_typo | Phishing | "Unusual sign-in" email linking to a repetition look-alike (the paper's attack) | Credentials submitted |
| phish_subdomain | Phishing | "Refund" email linking to `brand.com.account-verify.net` | Credentials submitted |
| concurrent | Concurrent login | Participant signs in; 2.5 s later the attacker starts a sign-in from a spoofed identical device | Attacker's push approved |
| fatigue | Push fatigue | Participant is told not to sign in; 6 attacker pushes arrive 10 s apart | Any attacker push approved |

When credentials are submitted on a phishing page, the app also starts a **real-time relay** push from the attacker, as a real phishing kit would, so phishing and push defences interact realistically.

## 5.3 Variables

| Type | Variable | How it is measured |
|---|---|---|
| Independent | Condition: Baseline / VoiceGuard | Set per block by the experimenter page |
| Independent (within) | Attack type: phishing / concurrent / fatigue | Task script |
| Control / covariate | Screen-reader experience (years), preferred speech rate, device platform | Pre-questionnaire; rate set in the app |
| Dependent (security) | Attack success (binary, per attack task) | Auto-scored from event log |
| | Reported the attack (binary) | "Report as phishing" or "Report: this wasn't me" |
| | Decision time (s) | Email opened → first action; push shown → decision |
| | Pushes before approval (fatigue task) | Event log |
| Dependent (usability) | Legitimate sign-in success and time to sign in | Event log |
| | SUS (0–100), raw NASA-TLX (0–100), trust (1–7) | After each block, in the experimenter page |
| | Preferences and reasons | Semi-structured debrief interview |

Phase 1 uses **ablation** (turning one component off at a time) to measure each component's contribution. Phase 3 compares the full system with the baseline, to keep the session short.

## 5.4 Apparatus

- **Computer:** a laptop running Windows 11 with NVDA, or the participant's own laptop and screen reader.
- **Phone:** an iPhone with VoiceOver or an Android phone with TalkBack. The participant's own phone is preferred. They open `/phone.html` over Wi-Fi.
- **Voice mode:** "My screen reader", so the participant's own screen reader speaks VoiceGuard's announcements.
- **Audio:** headphones for the computer and the phone speaker for push prompts. This reproduces the paper's PC + smartphone setting, used by 49.2% of screen-reader users.
- **Logging:** the app writes every event with a timestamp. With consent, we also make an audio recording for the qualitative analysis.
- **Credentials:** only a study password given on a braille or large-print card and read aloud. No real credentials are used at any point.

## 5.5 Procedure (about 75 minutes)

1. **Welcome and consent (10 min).** The consent form is an accessible document that is also read aloud. Participants consent to recording separately.
2. **Background questionnaire (5 min).** Age range, vision, screen readers used, years of use, preferred speech rate, how they normally check links, and past phishing experience.
3. **Familiarisation (5 min).** A neutral sign-in on both devices, with the speech rate adjusted to the participant's preference.
4. **Block 1 (15 min).** Six tasks. The experimenter reads each instruction exactly as scripted, presses Start, and presses End when the participant finishes or the time limit passes.
5. **Questionnaires (5 min).** SUS, NASA-TLX and trust, entered in the app.
6. **Break (5 min).**
7. **Block 2 (15 min)** in the other condition with brand set B, then the same questionnaires.
8. **Debrief interview (10 min).** We reveal the attacks and the cover story and play back each warning. We ask which version they would use, what helped or annoyed them, and whether the code word and NATO spelling made sense. Participants may withdraw their data.
9. **Compensation.**

# 6. Analysis plan

- **H1–H3 (attack success, paired binary):** McNemar's exact test per attack type. Holm correction across the three tests. Effect size is the paired odds ratio.
- **Pooled model:** a logistic mixed model, `success ~ condition + attack_type + block_order + condition:block_order + (1 | participant)`. It uses all four attack trials per block, which gives more power than the per-type tests, and the interaction term checks for carry-over.
- **Learning check:** participants become alert after their first attack, so we also analyse **block 1 only** as a *between-subjects* A/B comparison. The test is a chi-squared test (Fisher's exact test when expected counts are below 5).
- **H4 (usability):** paired t-tests on SUS and NASA-TLX, or Wilcoxon signed-rank if Shapiro-Wilk rejects normality. Time to sign in is compared with Wilcoxon signed-rank or a linear mixed model on log time. Legitimate success is compared with McNemar's test.
- **Decision time and pushes before approval:** Wilcoxon signed-rank, effect size r.
- **H5:** descriptive, against the paper's scores (Section 3), plus the Phase 1b replication with real screen readers.
- **Qualitative:** two group members code the interview notes independently using thematic analysis, then reconcile disagreements.
- **Significance level:** α = 0.05. We report effect sizes and 95% confidence intervals, not only p-values.

**Sample size.** We assumed that half of the participants are fooled at baseline but resist with VoiceGuard, and 5% the reverse. McNemar's exact test then has about 64% power with 16 participants, 79% with 20 and 87% with 24, for a single attack type. The pooled mixed model uses four attack trials per participant per block and has more power, so 20 participants is our target. With 12–16 participants the per-type tests are reported as exploratory.

# 7. Threats to validity and how we handle them

| Threat | Type | Mitigation |
|---|---|---|
| Learning and order effects | Internal | AB/BA counterbalancing; separate brand sets; randomised task order; check the condition × order interaction; block-1 between-subjects analysis |
| Participants guess the study is about attacks | Internal | Cover story; legitimate tasks mixed in; attacks embedded in ordinary-looking emails and sign-ins |
| Experimenter bias | Internal | Scripted instructions read verbatim; outcomes auto-scored from logs, not judged by the experimenter |
| Attack base rate is far higher than in real life | External | Acknowledged. Results show whether people *can* detect attacks, not how often they would in the wild. Future work: a diary study |
| Simulated sites and fictional brands | External | Realistic mail and bank flows on participants' own devices and screen readers |
| Pilot uses blindfolded sighted people | External | The pilot only checks the procedure; hypotheses are tested only with blind and visually impaired participants |
| Small, local sample | External / statistical | Exact tests and effect sizes; results described as preliminary; data and app released so others can replicate |
| Screen reader, OS and device versions | External | Record exact versions per session; Phase 1b covers four screen readers |

# 8. Ethics

- **Approval:** we submit to the IBA research ethics process before Phase 2. No participant is recruited before approval.
- **Accessible informed consent:** the consent form is a screen-reader-friendly document, read aloud, with time for questions. Consent to audio recording is separate.
- **Deception:** only the minimum needed (attacks are not announced in advance). A full debrief at the end explains why, and participants may withdraw their data.
- **No real credentials or accounts:** only fictional brands and a study password. Nothing leaves the study laptop.
- **Wellbeing:** fatigue pushes are capped at six, any task can be stopped, and breaks are offered. Being "phished" is framed in the debrief as the system's failure, not the participant's.
- **Privacy:** participants are identified only by ID (P01, P02, …). Data is stored on the study laptop and the group's private repository without names. Recordings are deleted after analysis.
- **Accessibility of the session itself:** the lab is step-free and easy to reach, a sighted guide is available on request, and remote participation on the participant's own devices is offered.

# 9. Timeline

| Week (2026) | Work |
|---|---|
| 26 Oct – 1 Nov | Finalise protocol and materials; submit for ethics review |
| 2 – 8 Nov | Phase 1b: real screen-reader recordings and transcription |
| 9 – 15 Nov | Phase 2 pilot (6–8 participants); fix issues |
| 16 Nov – 6 Dec | Phase 3 sessions (target 20) |
| 7 – 13 Dec | Analysis |
| 14 – 20 Dec | Final report and presentation |

**Proposed roles.**

- *Abdullah Feroz:* application, logging, Phase 1 and 1b evaluation.
- *Haris Shibli:* recruitment, scheduling, running sessions.
- *Qazi Muhammad Waiz:* ethics submission, questionnaires, statistical analysis.
- *All three:* piloting, interview coding and writing.

# 10. Expected results

| Measure | Paper / today | Expected with VoiceGuard |
|---|---|---|
| Similarity of `bankofamerica` / `bankoffamerica` as heard | 100% | ≈ 60% (measured in Phase 1) |
| Phishing credential submission | High; no audible cue | Large reduction (H1) |
| Concurrent attacker push approved | The attacker's push replaces the victim's; only 5% of users noticed in prior work | Large reduction; both pushes visible and code words differ (H2) |
| Fatigue: approval of a spam push | Possible after repeated prompts | Approve locked from the 3rd push (H3) |
| Legitimate sign-in time | — | At most 20% longer, SUS ≥ 68 (H4) |

# 11. Limitations

- Phase 1 models speech instead of recording real screen readers. Phase 1b closes this gap.
- VoiceGuard is a prototype layer inside the simulated browser and authenticator. Deploying it for real would need a screen-reader add-on (for example an NVDA add-on) and changes on the service side (code word and no-override pushes).
- The trusted list must be maintained. Brand names of three letters or fewer are deliberately not checked for single-letter typos, to avoid false alarms. A very slow push drip (15 minutes or more apart) is not detected.
- Like the paper, we study speech output only, not braille displays.

# Appendix A: Experimenter script (per task)

The experimenter reads the instruction shown on the study page word for word, presses **Start**, and does not help with security decisions. If asked "Is this safe?", the answer is: "Do what you would normally do."

# Appendix B: Debrief text (summary)

"Thank you. This study also tested how well people can spot attacks when using a screen reader. Some emails were fake, and some phone requests came from a simulated attacker. Being fooled is common and shows a problem with today's systems, not with you. We used this to test VoiceGuard, which tries to make these attacks audible. You can ask us to delete your data at any time."
