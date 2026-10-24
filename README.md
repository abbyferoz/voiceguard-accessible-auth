# VoiceGuard: Accessible and Secure Push and Phishing Protection for Screen-Reader Users

HCI course project (IBA, Fall 2026).

Group: Qazi Muhammad Waiz (28982), Haris Shibli (28988), Abdullah Feroz (29219)

The project builds on *Broken Access: On the Challenges of Screen Reader Assisted Two-Factor and Passwordless Authentication* (Akanda, Mahdad, Saxena, WWW '25). It tackles the three problems chosen in our report:

1. **Phishing.** Screen readers read look-alike domains identically.
2. **Concurrent login.** The attacker's push overrides the victim's.
3. **Notification fatigue.** Repeated pushes wear the user down.

## Getting started (group members)

| Guide | Read it when you want to |
|---|---|
| [How to run the app](docs/HOW_TO_RUN.md) | Install, download and start VoiceGuard, try a 5-minute demo, use a real phone |
| [Running the experiment](docs/RUNNING_THE_EXPERIMENT.md) | Learn what every tab does, run a study session, practise with teammates |
| [Making changes](docs/MAKING_CHANGES.md) | Find your way around the code, change brands, tasks or rules, and share your changes |

Quick start:

```bash
git clone https://github.com/abbyferoz/voiceguard-accessible-auth.git
cd voiceguard-accessible-auth/VoiceGuard
npm start
```

Then open http://localhost:3000.

## Repository layout

| Path | Contents |
|------|----------|
| `research_paper .pdf` | The paper we reviewed |
| `Broken_Access_Report.docx` | Our review and the problems we chose |
| `broken-access-presentation (1).pptx` | Our presentation of the paper |
| `VoiceGuard/` | The running application, tests and automated evaluation |
| `VoiceGuard_Experimental_Plan.docx` | How we will run the experiments |
| `VoiceGuard_Final_Report.docx` | Problems, our solution and findings |
| `docs/` | Guides for group members, and the text sources of the report and the plan |
