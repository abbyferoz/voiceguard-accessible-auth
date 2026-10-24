---
title: "VoiceGuard: Making Phishing, Concurrent-Login and Push-Fatigue Attacks Audible to Screen-Reader Users"
subtitle: "Project Report: problems, solution and findings"
---

**Course:** Human-Computer Interaction, IBA, Fall 2026

**Paper extended:** Akanda, Mahdad, Saxena. *Broken Access: On the Challenges of Screen Reader Assisted Two-Factor and Passwordless Authentication.* ACM Web Conference (WWW '25), Sydney, Australia.

| Name | Roll No. |
|---|---|
| Qazi Muhammad Waiz | 28982 |
| Haris Shibli | 28988 |
| Abdullah Feroz | 29219 |

# Summary

*Broken Access* showed that screen-reader users cannot hear the information they need to stay safe while signing in. Fake domains sound the same as real ones. An attacker's push notification can replace the user's own. Repeated prompts can wear a user down until they approve. The paper suggests fixes in one paragraph but never builds or tests them.

We built **VoiceGuard**, a screen-reader-aware security layer that implements and extends those fixes, along with a complete simulation and study environment for measuring it. VoiceGuard works through what is *spoken* to the user:

- It says **exactly how a fake domain differs** from the real one, letter by letter in the NATO alphabet.
- It **never lets one push hide another**, and links each push to the user's own sign-in with a **spoken code word**.
- It **detects push spam and locks approval**.
- It **gives users enough time to listen** before a request expires.

In our automated evaluation, which uses the paper's own similarity metric, VoiceGuard detected **99.6%** of 1,114 generated fake domains with **no false alarms** on 85 real sites. The paper's example pair `bankofamerica.com` / `bankoffamerica.com` sounds **100% identical** through a screen reader today and **60% similar** with VoiceGuard. In every simulated concurrent-login race, today's behaviour leaves only the attacker's push on the phone. VoiceGuard shows both pushes, warns the user, and still tells them apart when the attacker copies the victim's device and city. A study with blind and visually impaired participants is planned (see the separate Experimental Plan).

# 1. Background

Web services now protect accounts with two-factor and passwordless sign-in: one-time codes, push notifications and FIDO security keys. About 43 million people are blind and 295 million have moderate-to-severe visual impairment. They use these systems through **screen readers** such as NVDA, JAWS, VoiceOver and TalkBack, which turn the screen into speech.

*Broken Access* introduced **AWARE**, a semi-automated framework for checking authentication with screen readers. It has four steps:

1. Record what the screen reader says.
2. Transcribe it and score how clearly the original information survives, using TF-IDF cosine similarity.
3. Simulate attacks.
4. Fix the problems and run AWARE again.

The study covered six screen readers and twelve authentication methods. Every deployed method had an accessibility gap, a security gap, or both.

Our earlier report chose three of the paper's threats to work on: **phishing**, **concurrent login** and **notification fatigue**.

# 2. The problems

## 2.1 Phishing

- Screen readers read the name in a domain as a whole word, so small spelling tricks disappear. The paper measured `bankofamerica.com` against `bankoffamerica.com`, and `wellsfargo.com` against `wellssfargo.com`, and found **100% similarity**. The listener has no audible way to tell them apart.
- Browser phishing warnings are also poorly read out.
- The only fallback is checking the address letter by letter, which is slow and easy to defeat with long or complicated addresses.

## 2.2 Concurrent login

The attacker starts a sign-in at the same moment as the victim and hopes the victim approves the attacker's push instead of their own. The paper found:

- **Google Push** on VoiceOver and TalkBack: the attacker's notification **replaces** the victim's.
- **Duo Push** replaces the victim's notification and shows **no device details**, so the two requests are identical.
- **Microsoft's number-matching prompt** is safer, but a known technique can block it and present malicious options, with no screen-reader warning.
- Prior work found only **5%** of users noticed a concurrent-login attack.
- Device and city details do not help much, because attackers can copy them.

## 2.3 Notification fatigue

The attacker sends push after push until the user gives in. The paper found:

- **Google Push on VoiceOver:** after a denial, the victim is sent to a "change password" step, which they can confuse with the next attacker push.
- **Google Push on TalkBack:** the newest notification replaces the previous one.
- **Microsoft:** after one denial, later prompts become a simple approve/deny that is easy to spam.
- **Duo:** protected only if an administrator has capped the number of attempts.

## 2.4 One shared cause: time

The paper also found that comprehension collapses at faster speech rates: 37% at the default rate, 18% at 60%, and 0% at 80% or above. Deployed services still use fixed expiry windows that ignore how long it takes to *hear* a request.

# 3. Our solution: VoiceGuard

## 3.1 Design idea and name

All three attacks exploit the **voice channel**: what the screen reader says, when it says it, and what it leaves out. VoiceGuard therefore fixes the spoken experience. Visual cues are kept, but every protection is designed to be **heard** first. The paper recommended three things: phishing detection inside the screen reader, announcing the service name, and a detector for repeated notifications. We turned each into a concrete, testable mechanism.

Following our report's advice, we treat concurrent login and fatigue as **one push-abuse track**. A single *push guard* handles both, alongside a *domain guard* for phishing.

## 3.2 HCI principles applied

| Principle (course topic) | Where VoiceGuard applies it |
|---|---|
| Visibility of system status | Every waiting request stays listed and is counted ("request 1 of 2"). The real domain is announced on every page load. |
| Error prevention | Fake sites are blocked before loading. Approve is locked during push spam. |
| Feedback | A warning tone plus a spoken warning. Each decision is confirmed ("Approved", "Reported"). |
| Match with the user's mental model | Users expect a push to be *theirs*. The code word ties each push to the sign-in they just started. |
| Recognition rather than recall | Instead of making the user remember and compare a whole spelling, VoiceGuard names the real site and the exact difference. |
| Accessibility of time | Expiry windows adapt to how long the request takes to speak. |

## 3.3 Solving Problem 1: Phishing (the domain guard)

**What it does.** Whenever a link gets focus or a page loads, the domain guard asks two questions: *is this really the site it looks like?* and *if not, how do we say the difference out loud?*

**How it works.**

1. **Take the address apart.** Find the part of the domain that actually owns the site. In `northwindbank.com.secure-login.net`, that is `secure-login.net`. Country endings such as `.com.pk` are handled. Text before an `@` is treated as fake, as in `paypal.com@evil.net`. Punycode addresses (`xn--…`) are decoded so foreign look-alike letters are visible.
2. **Compare with the user's trusted sites** using nine checks:

| Trick | Example | Detected by |
|---|---|---|
| Doubled letter | `bankoffamerica.com` | Collapsing repeated letters gives the trusted name |
| Missing letter | `gogle.com` | Edit-distance algorithm |
| Swapped letters | `googel.com` | Edit-distance algorithm |
| Replaced letter | `goofle.com` | Edit-distance algorithm |
| Look-alike characters | `paypa1.com`, `rnicrosoft.com` | Mapping `1`→l, `rn`→m and so on gives the trusted name |
| Foreign letters | `pаypal.com` (Cyrillic а) | Unicode look-alike table |
| Different ending | `paypal.net` | Same name, different ending |
| Extra words | `paypal-login.com` | Trusted name plus extra words |
| Brand in subdomain | `paypal.com.secure-login.net` | Trusted name appears only in the subdomain |

3. **Say only the difference**, using the NATO alphabet so letters cannot be misheard:

| Fake domain | Screen reader today | VoiceGuard |
|---|---|---|
| `bankoffamerica.com` | "bankoffamerica dot com" | "Warning! Look-alike link. It goes to bankoffamerica dot com, not bankofamerica dot com. It has a double F, as in Foxtrot, after N, K, O. This is likely a phishing site." |
| `paypa1.com` | "paypa1 dot com" | "…It uses digit one in place of the letter L." |
| `pаypal.com` (Cyrillic) | "paypal dot com" | "…It uses a foreign character that looks like A." |
| `paypal.com.secure-login.net` | "paypal dot com dot secure dash login dot net" | "…The real address is secure dash login dot net. The name paypal is only put at the front to trick you." |

4. **Act on it.**
   - When a link gets focus, VoiceGuard speaks the warning and plays an alarm tone.
   - When a page loads, it announces the real domain ("Verified site: northwindbank dot com"), as the paper recommends.
   - Before a fake page loads, an accessible **blocking dialog** appears with keyboard focus on "Go back to safety".

**Why this is better than spelling.** Spelling the whole address still leaves the user to compare it from memory against the real one. VoiceGuard does the comparison and tells the user which real site was copied and how.

## 3.4 Solving Problem 2: Concurrent login (the push guard)

1. **No override.** Every pending request stays on the phone and is counted. The attacker's push can no longer replace the user's.
2. **Context in speech.** Each push is spoken in full: *"Sign-in request 2 of 2 for Northwind Bank. From Chrome on Windows, near Karachi, started just now."*
3. **Spoken code word.** When the user signs in, the computer says *"Your code word is FALCON. Only approve a request that says FALCON."* Each push speaks its own word, so the attacker's request says something else, such as *"BRIDGE"*. The paper notes that attackers can copy device and city. They cannot know the code word, so it still separates the two requests when everything else matches.
4. **Concurrency alert.** *"Caution: 2 sign-in requests are waiting at the same time. Only one can be yours. Approve only the one whose code word matches your computer."* Requests from an unfamiliar device are also flagged.
5. **Report button.** Every push can be reported as "this wasn't me".

## 3.5 Solving Problem 3: Notification fatigue (the push guard)

1. **Detection rules.** Spam is assumed when **3 or more requests arrive within 2 minutes** (fast spam) or **2 or more are refused or missed within 10 minutes** (slower spam).
2. **Approval lock.** When spam is detected, Approve is locked for 5 minutes and the reason is spoken: *"Attackers send many requests to wear you down. Approve is locked for now. If you did not just sign in, choose Report."* The server enforces the lock as well, so it cannot be bypassed from the screen.
3. **No confusing follow-up step.** Pushes are never mixed with a "change password" prompt in the same place.

## 3.6 Shared fix: adaptive expiry

Each request's expiry window is set to the time needed to hear it **twice plus 30 seconds**, and never less than the usual 60 seconds. A *"15 seconds left"* warning is spoken. At the default rate, VoiceGuard's announcement takes about 19 s, which gives a 68 s window. At a slower rate (0.75×) the window grows to 81 s.

# 4. What we built

## 4.1 The application

VoiceGuard is a web application with no dependencies (Node.js 18 or newer). Start it with `npm start` inside `VoiceGuard/`. It simulates the paper's **PC + smartphone** setting, which 49.2% of screen-reader users work in.

| Page | Purpose |
|---|---|
| Computer (`pc.html`) | A simulated browser with an address bar, mail inbox, bank and payment sign-in, and a fake clone of the bank. A panel shows everything that was spoken. |
| Phone (`phone.html`) | A push-approval app. It can also be opened on a **real phone** on the same Wi-Fi, where VoiceOver or TalkBack read it. |
| Attacker console (`attacker.html`) | Sends phishing emails using any of the nine tricks (with a preview of how they sound today and with VoiceGuard), arms a concurrent-login race, and sends push spam. |
| Experimenter (`study.html`) | Runs study sessions (Section 4.2). |
| Results (`results.html`) | Shows the automated evaluation and the study results, comparing baseline and VoiceGuard. |

**Two conditions.**

- **Baseline** reproduces today's behaviour as reported in the paper: domains read as whole words, the newest push replacing the older one, no device details, and a "change password" prompt after a denial.
- **VoiceGuard** turns on the protections.

**Voice modes.** VoiceGuard can speak with a built-in voice (for pilot testers), send text to the participant's **own screen reader** through ARIA live regions, do both, or stay silent.

**Realism.** If a participant types a password into a fake page, the server immediately starts an attacker sign-in that sends a push to the phone. This is how real-time phishing kits work, so the phishing and push defences interact as they would in real life. Only fictional brands are used (Northwind Bank, Contoso Pay, Fabrikam Bank, Tailspin Pay), with a study password.

## 4.2 The experimenter console

The experimenter page runs a user study from start to finish.

- **Participant and block.**
  - Enter an ID (P01, P02, …) and choose block 1 or 2.
  - The page counterbalances automatically: odd IDs do baseline first, even IDs do VoiceGuard first.
  - Block 1 always uses brand set A and block 2 uses brand set B, so the same fake emails are never seen twice.
- **Six scripted tasks per block**, in a random but reproducible order for each participant:
  - two legitimate sign-ins
  - two phishing emails: a doubled letter and a brand in the subdomain
  - one concurrent-login race
  - one push-spam attack
- **Running a task.**
  - Pressing Start resets both devices and sets up the scenario, such as delivering an email or arming the attacker.
  - The experimenter can read the instruction aloud, watch a timer against a suggested time limit, and type observer notes.
  - Pressing **End task and score** grades the task automatically from the event log: attack succeeded or resisted, what the participant did, how long they took to decide, how many warnings they heard, whether they reported the attack, and how many spam pushes came before an approval.
- **Questionnaires** after each block:
  - System Usability Scale, scored 0–100 automatically
  - NASA-TLX workload
  - a trust rating
  - interview notes
- **Advanced settings.**
  - Force a condition.
  - Change the speech rate.
  - Switch individual protections on or off (domain warning, page announcement, blocking page, push context, code word, concurrency alert, fatigue lock, adaptive expiry). This lets us measure what each component contributes (ablation).
- **Export.** Download results, the full event log and the questionnaires as CSV files for analysis in Excel, R or SPSS.

## 4.3 Testing

- 13 automated unit tests cover both guards, and all pass.
- We tested every scenario in the browser in both conditions:
  - In baseline, the phishing link opened the fake bank and the attacker's relay push was approved. This was scored as attack success.
  - With VoiceGuard, the link was blocked and scored as resisted.
  - In the concurrent race, both pushes were shown with different code words. The participant approved their own and reported the attacker's.
  - Under spam, Approve locked at the third push.

# 5. Findings (automated evaluation)

Like AWARE, we evaluated VoiceGuard automatically before involving participants. Run `npm run eval`. Results are saved in `VoiceGuard/eval/results/`.

## 5.1 Phishing

**Method.**

- We took **50 real, frequently phished brands**, including HBL, Meezan Bank, JazzCash and Easypaisa, and generated up to three fakes per trick, giving **1,114 fake domains**.
- For false alarms we used **85 legitimate sites** that are not on the trusted list.
- For each fake we compared what the listener hears for the real link and for the fake one, today and with VoiceGuard. We used **TF-IDF cosine similarity**, the paper's metric, after normalising spellings that sound alike.

| Finding | Result |
|---|---|
| Fakes detected, with the correct real site named | **99.6%** (1,110 of 1,114) |
| False alarms on legitimate sites | **0%** (0 of 85) |
| `bankofamerica` / `bankoffamerica`, how similar they sound | **100% today → 60.4% with VoiceGuard** (reproduces the paper's 100%) |
| `wellsfargo` / `wellssfargo` | **100% → 59.5%** |
| Fakes that sound *identical* today | 21.4% overall, including **98%** of doubled-letter and **100%** of foreign-letter fakes |
| Fakes that sound identical with VoiceGuard | **0%** |
| Average similarity, all tricks | 68.8% today → 48.2% with VoiceGuard |
| Listening time | 4.1 s for VoiceGuard's difference sentence vs 5.0 s to spell the whole address |

| Trick | Detected | Sounds identical today | Similarity today | With VoiceGuard |
|---|---|---|---|---|
| Doubled letter | 99.2% | 98.4% | 99.4% | 53.5% |
| Missing letter | 99.2% | 0.8% | 60.7% | 45.5% |
| Swapped letters | 100% | 0% | 46.8% | 45.3% |
| Replaced letter | 98.6% | 0% | 52.9% | 41.7% |
| Look-alike characters | 100% | 0% | 53.1% | 52.7% |
| Foreign letters | 100% | 100% | 100% | 54.5% |
| Different ending | 100% | 0% | 77.9% | 51.3% |
| Extra words | 100% | 0% | 73.1% | 55.5% |
| Brand in subdomain | 100% | 0% | 57.8% | 37.9% |

**What this means.**

- The two tricks that are truly *inaudible* today, doubled letters and foreign letters, are exactly the paper's concern. VoiceGuard detects them and makes them clearly different to the ear.
- Tricks such as swapped letters were already partly audible, which explains their smaller gains. Even there, VoiceGuard adds the most important information: that the site is fake, and which real site it copies.
- The only misses were one-letter changes to the three-letter brand "hbl.com". Very short names are deliberately not checked for one-letter typos, because doing so would cause false alarms.

## 5.2 Concurrent login and fatigue

We replayed attack timings through the push guard. All eight checks passed.

| Check | Result |
|---|---|
| Today: the attacker's push hides the victim's when it arrives second | True for every race tested (0–60 s apart) |
| VoiceGuard warns about concurrent requests | Yes, for every race while the victim's request is still waiting |
| Attacker copies the victim's browser, OS and city | Device details alone can no longer tell the two apart; **the code word still can** |
| Push spam at intervals from 5 s to 5 min | Warning and Approve lock by the **3rd push**, whether the user denies or ignores the pushes |
| Normal single sign-in, or a retry after a timeout | No warning (no false alarm) |
| Expiry leaves time to hear the request twice plus 30 s | Yes, at every speech rate tested |
| Known limit | Very slow spam (one push every 15 minutes) is not detected |

# 6. Discussion

**What we learned.**

1. The paper's key phishing problem is about **audibility**, not detection. Detection algorithms for fake domains are well understood. What was missing is a way to *say* the result so a listener can act on it. Naming the exact difference with the NATO alphabet turns a 100% audio match into a clearly different message.
2. For push attacks, **interface behaviour matters more than extra information**. Device and city details can be faked, and a newer push can bury an older one. Keeping every request visible and adding a code word that the attacker cannot know is a stronger fix than more detail.
3. **Fatigue protection has to act, not only warn.** A warning alone can itself be worn down. Locking approval for a short time removes the "give in to make it stop" option.

**Trade-offs.**

- **Longer announcements.** VoiceGuard's warnings are longer (about 10 s for a full link warning). We put the critical words first ("Warning! Look-alike link") so users can act before the end.
- **False alarms.** Too many warnings would train users to ignore them. We kept a 0% false-alarm rate on the 85 legitimate sites, partly by not checking typos in very short names.
- **Lock-out risk.** A genuine user who denies twice by accident is locked out for 5 minutes. A security key or other sign-in method should remain available.
- **Deployment.** In practice VoiceGuard would need to be split between a screen-reader add-on (domain warnings) and the service provider (no-override pushes and code words). Our prototype shows the user experience, not that deployment.

**Limitations.**

- No blind or visually impaired participants have used VoiceGuard yet, so all results are **pre-user-study**, the same status the paper gives AWARE.
- The similarity scores come from a model of speech, not recordings of real screen readers. The next phase records NVDA, JAWS, VoiceOver and TalkBack to confirm them.
- Like the paper, we cover speech output only, not braille displays.

# 7. Next step: the user study

The full protocol is in **VoiceGuard_Experimental_Plan.docx**. In short:

- **Design:** within-subjects (baseline vs VoiceGuard), counterbalanced, with attacks hidden among normal tasks and a cover story, followed by a full debrief.
- **Participants:** 20 blind and visually impaired screen-reader users, after a blindfolded pilot with 6–8 people.
- **Measures:** attack success, reporting, decision time, legitimate sign-in success and time, SUS, NASA-TLX and trust.
- **Analysis:** McNemar's exact test and a logistic mixed model, plus a block-1-only chi-squared comparison to check for learning effects.
- **Ethics:** IBA ethics approval before recruiting, accessible consent, no real credentials, and anonymised data.

# 8. Conclusion

*Broken Access* showed that sign-in security fails screen-reader users through the audio channel. VoiceGuard shows that this can be fixed:

- Say exactly how a fake site differs from the real one.
- Never let one push hide another.
- Tie each push to the user's own sign-in with a spoken code word.
- Stop push spam by acting on it, not only warning about it.
- Give users enough time to listen.

Our automated evaluation reproduces the paper's 100% similarity finding and shows VoiceGuard removing it. It detects 99.6% of fake domains with no false alarms and defends against concurrent-login and fatigue attacks in every simulated case. The application, data and study tools are ready for the user study that will confirm these results with blind and visually impaired users.

# Appendix A: Answers to our discussion questions

**Q9. Phishing: which design principle fails, and how would we redesign it?** The failure is **visibility**, together with **error prevention**. The critical information (a spelling difference) is visible on screen but invisible in audio. Our redesign announces the real domain on every page, names the exact difference in the NATO alphabet, and blocks the fake page before it loads.

**Q10. Concurrent login: why can the attacker's push be approved, and how should it be fixed?** The newest push replaces the older one, and the interface gives no **feedback** that two requests exist. It also offers nothing that matches the user's **mental model** that "this push is mine". The fix keeps every request visible and counted, speaks the requesting device, and ties each push to the user's sign-in with a code word spoken on both devices.

**Q11. How would we measure notification fatigue?**

- **Independent variable:** condition (baseline vs VoiceGuard), within subjects and counterbalanced.
- **Dependent variables:** whether any spam push is approved, how many pushes come before approval, decision time, and NASA-TLX frustration.
- **Assignment:** odd and even participant IDs give AB/BA order. The experimenter page does this automatically.

**Q12. A study of one mitigation (announcing service and device name).**

- **Participants:** 20 screen-reader users.
- **Measures:** approval rate of concurrent attacker pushes and decision time.
- **Analysis:** McNemar's test, plus an ablation using the component switches (context announcement on vs off, code word on vs off).
- **Ethics:** accessible consent, deception kept to the minimum with a full debrief, no real credentials, and anonymised data.

# Appendix B: Running the application

1. Install Node.js 18 or newer.
2. In the `VoiceGuard` folder, run `npm start` and open `http://localhost:3000`.
3. Open the **Computer** and **Phone** pages and press Start on each.
4. Use the **Attacker** page to run attacks. On the **Experimenter** page, open Advanced to switch between Baseline and VoiceGuard.
5. Run `npm test` for the unit tests and `npm run eval` to regenerate the evaluation results.
