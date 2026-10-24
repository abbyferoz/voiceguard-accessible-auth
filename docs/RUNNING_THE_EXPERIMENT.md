# Running the experiment

This guide explains what every tab of VoiceGuard does, how to run a study session, and how to practise the whole experiment on your own or with teammates. The full study design (hypotheses, statistics, ethics) is in `VoiceGuard_Experimental_Plan.docx`.

Start the app first (see [HOW_TO_RUN.md](HOW_TO_RUN.md)), then open **http://localhost:3000**.

## 1. What each tab does

### Home (`/`)
Links to every other tab, plus a short demo checklist. The badge at the top right shows the current mode: **Baseline** or **VoiceGuard on**.

### Computer (`/pc.html`): the participant's laptop
A pretend web browser, as the participant experiences it.

- **Address bar** at the top, with **Back** (←) and **Start page** (⌂) buttons.
- **Start page:** three bookmarks: Campus Mail, the bank, and the payment app.
- **Campus Mail:** the inbox. Study emails, both real and fake, arrive here.
- **Bank and payment sites:** a sign-in form. Signing in sends a push to the phone. In VoiceGuard mode the page also shows and speaks a **code word**.
- **Fake sites:** a lookalike copy of the bank. Typing a password here counts as being phished, and it also triggers the attacker's own sign-in to the phone, as real phishing kits do.
- **Spoken output panel:** a written log of everything the "screen reader" said.
- **Voice** menu: *Built-in voice* (the computer talks), *My screen reader* (NVDA, JAWS or VoiceOver talks instead), *Both*, or *Silent*.

What changes between modes:

| | Baseline (today's behaviour) | VoiceGuard |
|---|---|---|
| Link to a fake site | Read like any link: "bankoffamerica dot com" | "Warning! Look-alike link… It has a double F, as in Foxtrot…" plus an alarm sound |
| Opening a fake site | Opens normally | Blocked by a "Look-alike website blocked" page. Focus starts on **Go back to safety** |
| Page load | Page title only | "Verified site: northwindbank dot com", or a danger warning |
| Signing in | "Check your phone" | Also speaks a code word, the device and the city |

### Phone (`/phone.html`): the participant's phone
The authenticator app that receives push requests. It can run in a second window, or on a real phone on the same Wi-Fi with VoiceOver or TalkBack.

| | Baseline (today's behaviour) | VoiceGuard |
|---|---|---|
| Several requests | Only the newest is shown; it replaces the older one | All waiting requests are listed, each with a heading ("request 1 of 2") |
| What is said | "Northwind Bank. Are you trying to sign in? Approve. Deny." | Service, device, city, how long ago, code word, and any warnings |
| Re-hearing requests | Not possible | **Read all waiting requests**, **Repeat this request** on each request, and **Stop reading** |
| Buttons | Yes / No, it's not me | Approve / Deny / **Report: this wasn't me** |
| After Deny | A "Secure your account: Change password" prompt appears where the next push will appear (a flaw found in the paper) | "Denied. 1 more request waiting." |
| Push spam | Nothing special | Warning, and **Approve is locked** for 5 minutes |
| Time limit | Fixed 60 s | Long enough to hear the request twice plus 30 s, with a "15 seconds left" warning |

### Attacker (`/attacker.html`): you play the attacker
For demos and free testing. In a real session the Experimenter tab triggers attacks automatically.

1. **Phishing email:** choose the brand to fake and the trick (doubled letter, missing letter, look-alike character and so on). The preview shows the fake address, what a screen reader says today, and what VoiceGuard says. **Send to victim inbox** delivers it to the Computer's mail.
2. **Concurrent login:**
   - **Arm** waits until the participant signs in, then starts the attacker's sign-in a moment later (2,500 ms by default).
   - **Send attacker push now** sends one immediately.
   - **Spoof the victim's browser, OS and city** makes the attacker's push look identical to the victim's.
3. **Push fatigue:** set how many pushes to send and how often, then **Start spamming**. **Stop all attacks** cancels everything.
- **Push requests table:** every push, with who sent it, its code word and its status (pending, approved, denied, reported, expired).
- **Event feed:** a live log of everything that happens. Successful attacks are shown in red.

### Experimenter (`/study.html`): runs a study session
Use this tab during a real or practice session. The participant should not see it.

**1. Participant and block**
- **Participant ID:** P01, P02 and so on.
- **Block:** 1 or 2. Each participant does both blocks.
- **Apply block settings** sets everything for that participant and block and resets the devices:
  - Odd IDs do **Baseline in block 1** and **VoiceGuard in block 2**; even IDs the reverse. This counterbalances learning effects.
  - Block 1 always uses brand set A (Northwind Bank, Contoso Pay) and block 2 uses brand set B (Fabrikam Bank, Tailspin Pay), so nobody sees the same fake email twice.
- **Advanced:**
  - **Condition:** force Baseline or VoiceGuard.
  - **Speech rate:** 1.0× to 2.0×.
  - **VoiceGuard components:** switch individual protections on or off to measure what each contributes (ablation).

**2. Current task**: shown while a task is running.
- The instruction to read to the participant, with **Read instruction aloud**.
- An elapsed-time counter. It turns red after the suggested limit.
- **Observer notes:** anything you notice.
- **End task and score:** stops the task and scores it automatically.

**3. Tasks for this block**: the six tasks, in a random order that stays the same for each participant.

| Task | What the participant is asked | What the app sets up | Attack succeeds if |
|---|---|---|---|
| legit_email | Open the bank's statement email and sign in | A real email from the bank | — (success = signed in) |
| legit_login | Sign in to the payment app from the bookmark | Nothing | — (success = signed in) |
| phish_typo | Deal with a "security check" email | Fake email to a doubled-letter domain | Password typed on the fake site |
| phish_subdomain | Deal with a "refund" email | Fake email to `brand.com.account-verify.net` | Password typed on the fake site |
| concurrent | Sign in to the bank | Attacker signs in 2.5 s after the participant, from an identical-looking device | The attacker's push is approved |
| fatigue | Take a break; answer the phone as normal | 6 attacker pushes, 10 s apart, starting after 5 s | Any attacker push is approved |

**Start** resets both devices (Computer goes to the start page, inbox and phone are cleared) and sets up the task. After **End task and score**, the outcome column shows the result:

- **attack_success / resisted** for attack tasks.
- **legit_success / legit_fail** for normal sign-ins.
- **Details:**
  - phishing tasks: `went_back_from_warning`, `opened_link`, `submitted_credentials`, `approved_relay_push`, `reported`
  - push tasks: `approved_own`, `approved_attacker`, `reported`

Behind the scenes the app also records:
- decision time (from opening the email, or from the push arriving, to the first action)
- warnings heard
- pushes sent, and how many came before an approval
- time to sign in

Use **Redo** to repeat a task. Every attempt is kept.

**Bottom buttons:**
- **Reset devices** clears the inbox and phone without ending a task.
- **Download results / events / questionnaires.csv** exports the data for Excel, SPSS or R.

**4. Questionnaires**, filled in after each block:
- **System Usability Scale:** 10 statements rated 1–5, turned into a 0–100 score automatically. 68 or above is above average.
- **NASA-TLX:** six workload sliders, 0–100.
- **Trust:** "I could tell which requests and links were safe", 1–7.
- **Comments / interview notes.**

Press **Save questionnaire for this block**. The questionnaire is linked to the current participant, block and condition.

### Results (`/results.html`)
- **Automated evaluation:** results of `npm run eval`: detection rate, false alarms, how similar fake and real links sound today versus with VoiceGuard, and the push-guard checks.
- **User study:** attack success for Baseline versus VoiceGuard (bars), a summary table (attack success, decision times, sign-in success and time, SUS, NASA-TLX), the questionnaires, and every task result.
- Press **Refresh** after finishing tasks.

## 2. Running a real session (about 75 minutes)

**Setup before the participant arrives**

1. Start the app (`npm start`).
2. Participant's laptop: open `/pc.html`.
3. Participant's phone: open `/phone.html` over Wi-Fi, or use a second window.
4. Set **Voice** to *My screen reader* if the participant uses their own screen reader, or *Built-in voice* otherwise. Press **Start** on both.
5. Experimenter's device (ideally a separate laptop on the same Wi-Fi): open `http://<address>:3000/study.html`. Use the address the terminal printed.
6. Have the study password ready. Never let anyone type a real password.

**During the session**

1. Consent, background questions, and a short practice sign-in. These are described in the Experimental Plan.
2. Experimenter page: type the **Participant ID**, choose **Block 1**, press **Apply block settings**.
3. For each of the 6 tasks, in the order shown:
   1. Read the instruction **exactly as written**.
   2. Press **Start**.
   3. Let the participant act. Don't help with security decisions. If asked "is this safe?", answer "Do what you would normally do."
   4. When they are finished, or the timer turns red, press **End task and score**.
4. Fill in the **questionnaires** for block 1 and save.
5. Short break.
6. Choose **Block 2**, press **Apply block settings**, and repeat steps 3–4.
7. **Debrief:** explain that some emails and pushes were attacks, and why the participant wasn't told beforehand. Ask which version they preferred and why. Note their answers in the comments.

**After the session**

- Check the **Results** tab.
- Download the three CSV files and back them up.

## 3. Practising on your own or with teammates

**Solo walkthrough (15 minutes):** open Computer, Phone and Experimenter side by side, set Voice to *Built-in voice*, and play both participant and experimenter. Run all six tasks in Baseline and then in VoiceGuard. Try to "fall for" the attacks in Baseline, and notice what VoiceGuard tells you.

**Group pilot (recommended before real participants):**

| Role | Does |
|---|---|
| Participant | Wears a blindfold, uses the Computer and Phone by keyboard or touch with the built-in voice |
| Experimenter | Runs the Experimenter tab on a separate laptop and reads the instructions |
| Observer | Watches, takes notes, and times anything that feels slow or confusing |

Swap roles so everyone tries each one. Afterwards, check that every task ended with the outcome you expected.

**Keep practice data separate.** Start the app with its own data folder so practice runs don't mix with real sessions:

```bash
DATA_DIR=data/practice npm start
```

Real sessions then use plain `npm start` and save to `data/`. To start completely fresh, stop the app and delete the folder you were using.

## 4. Extra experiments you can run with the same tools

- **Ablation:** under Advanced, switch off one protection (for example *codeWord*) and re-run the concurrent task. This shows how much that protection matters on its own.
- **Speech rate:** run the same tasks at 1.0× and 1.5× to test the paper's finding that faster speech hurts comprehension.
- **Real screen readers:** set Voice to *My screen reader* and test with NVDA (Windows), VoiceOver (Mac or iPhone) or TalkBack (Android).
- **Free play:** use the Attacker tab to try other tricks (Unicode letters, wrong ending, extra words) outside the scripted tasks.
