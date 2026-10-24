# How to run VoiceGuard

This guide takes you from nothing to a running copy of the app on your own laptop.

## 1. What you need

| Tool | Why | Check it with |
|---|---|---|
| **Node.js 18 or newer** | Runs the app | `node -v` |
| **Git** | Downloads the project | `git --version` |
| **Chrome** (recommended) | Opens the app | — |

If either command prints "command not found", install it first:

- Node.js: download the **LTS** version from https://nodejs.org and run the installer.
- Git: on macOS run `xcode-select --install`; on Windows download it from https://git-scm.com.

There is nothing else to install. The app has no extra packages, so there is no `npm install` step.

## 2. Get access to the repository

The repository is **private**. Ask Abdullah to add you as a collaborator (GitHub → the repository → **Settings → Collaborators → Add people**). Accept the invitation email, then continue.

## 3. Download the project

Open a terminal (Terminal on macOS, PowerShell or Git Bash on Windows) and go to the folder where you want the project:

```bash
git clone https://github.com/abbyferoz/voiceguard-accessible-auth.git
cd voiceguard-accessible-auth
```

If Git asks you to sign in, use your GitHub account. If it asks for a password, it needs a personal access token, not your GitHub password. The easiest way around this is to install the GitHub CLI and run `gh auth login` once.

## 4. Start the app

```bash
cd VoiceGuard
npm start
```

You should see:

```
VoiceGuard running at http://localhost:3000
On a phone on the same Wi-Fi, open http://192.168.x.x:3000/phone.html
```

Open **http://localhost:3000** in Chrome. Keep the terminal window open while you use the app. To stop it, click the terminal and press **Ctrl + C**.

## 5. Try it in five minutes

1. Open **Computer** (`/pc.html`) and **Phone** (`/phone.html`) in two windows side by side. Press **Start** on each; browsers need one click before they are allowed to play sound.
2. Open **Attacker** (`/attacker.html`) and **Experimenter** (`/study.html`) in two more tabs.
3. On the Experimenter page, open **Advanced**, set **Condition** to **Baseline** and press **Apply**. The badge at the top of every page shows the current mode.
4. **Phishing:** on the Attacker page choose *repetition* and press **Send to victim inbox**. On the Computer, open **Campus Mail**, open the new email, and press Tab until the link is selected. Listen to how the fake domain sounds.
5. **Concurrent login:** on the Attacker page press **Arm**. On the Computer, open the bank bookmark, type any password and press **Sign in**. Look at the phone: only one push is shown, and it is the attacker's.
6. **Push fatigue:** on the Attacker page press **Start spamming**, then keep pressing **No, it's not me** on the Phone.
7. Set **Condition** to **VoiceGuard**, press **Apply**, and repeat steps 4–6 to hear and see the difference.

Everything the app says also appears in the **Spoken output** panel. If you don't want sound, set **Voice** to *Silent*.

## 6. Use a real phone (optional)

1. Connect the phone to the **same Wi-Fi** as the laptop.
2. On the phone, open the address the terminal printed, for example `http://192.168.0.103:3000/phone.html`.
3. Turn on **VoiceOver** (iPhone: Settings → Accessibility) or **TalkBack** (Android: Settings → Accessibility).
4. Set **Voice** at the top of the page to **My screen reader**, so the phone's own screen reader does the talking.

## 7. Get the latest version

When someone pushes changes, update your copy:

```bash
git pull
```

Then stop the app (Ctrl + C) and start it again with `npm start`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `node: command not found` | Install Node.js (step 1), then open a **new** terminal window. |
| `Error: listen EADDRINUSE` / port already in use | The app is already running in another window, or something else uses port 3000. Stop the other one, or start on another port: `PORT=3001 npm start` (Windows PowerShell: `$env:PORT=3001; npm start`). |
| No sound | Press **Start** on each page, check that **Voice** is not *Silent*, and unmute the browser tab. |
| Phone can't open the page | Same Wi-Fi? On macOS allow Node in **System Settings → Network → Firewall**. On Windows allow Node through the firewall when asked. University Wi-Fi sometimes blocks devices from reaching each other; a phone hotspot works instead. |
| Page looks stuck or old | Reload the page. If you changed code, restart the app (Ctrl + C, then `npm start`). |
| `npm start` says it can't find `package.json` | You are in the wrong folder. Run `cd VoiceGuard` first. |
