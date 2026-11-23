# VoiceGuard — blind-user session transcript (Baseline)

| | |
|---|---|
| Condition | Baseline (today’s behaviour) |
| Participant ID | P01 (synthetic) |
| Block / brand set | 1 / A (Northwind Bank, Contoso Pay) |
| Voice mode | "My screen reader" — announcements go to the ARIA live regions |
| Input | keyboard only (Tab / Enter / typing) |
| App | http://localhost:3100 (isolated instance, `DATA_DIR=data/blind-user-test`) |
| Recorded | 23/11/2026, 8:07:04 pm |

Every line below is what the app actually said, read from the app's own
"Spoken output" panel. `PC` is the participant's computer, `PHONE` is the phone.
`▸ focus` lines are where keyboard focus moved, which is what a screen reader
announces about the control.

## Task outcomes (scored by the app itself)

| Task | Outcome | Detail | Warnings heard | Decision time |
|---|---|---|---|---|
| `legit_email` | legit_success | signed_in | 0 | 2079 |
| `legit_login` | legit_success | signed_in | 0 | 2072 |
| `phish_typo` | attack_success | opened_link;submitted_credentials;approved_relay_push | 0 | 1803 |
| `phish_subdomain` | attack_success | opened_link;submitted_credentials;approved_relay_push | 0 | 1802 |
| `concurrent` | attack_success | approved_attacker | 0 | 1819 |
| `fatigue` | resisted | no_approval | 0 | 1463 |

## Transcript

### Task

> **Instruction read aloud:** 

- ▸ focus → Start and turn on audio
- **PC**: “Computer ready. You are on the start page.”
- ▸ focus → Start and turn on audio
- **PHONE**: “Phone ready.”

### Task

> **Instruction read aloud:** You have a new email from your bank about your monthly statement. Open it and sign in to see the statement.

- ▸ focus → VoiceGuardComputer
- ▸ focus → Built-in voice My screen reader Both Silent (transcript only)
- ▸ focus → Back
- ▸ focus → Start page
- ▸ focus → Campus Mailmail.campusmail.edu
- ▸ focus → statements@northwindbank.comUnread. Your Northwind Bank statement is ready
- **PC**: “Inbox. 3 messages, 1 unread.”
- ▸ focus → Back to inbox
- **PC**: “Message from statements. Subject: Your Northwind Bank statement is ready. Your monthly statement for October is ready. Sign in to Northwind Bank to view it.”
- **PC**: “Link. View your statement. northwindbank dot com”
- ▸ focus → View your statement
- ▸ focus → Password
- **PC**: “Northwind Bank. Sign in. Heading level 1.”
- ▸ focus → Sign in
- **PC**: “Check your phone. We sent a notification to your phone. Tap Yes to sign in.”
- ▸ focus → Northwind Bank
- **PHONE**: “Northwind Bank. Are you trying to sign in? Approve. Deny.”
- **PC**: “Signed in. Welcome back to Northwind Bank.”
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Yes
- **PHONE**: “Approved.”

### Task

> **Instruction read aloud:** Sign in to your payment app using the bookmark on the start page.

- ▸ focus → Campus Mailmail.campusmail.edu
- ▸ focus → Northwind Banknorthwindbank.com
- ▸ focus → Contoso Paycontosopay.com
- ▸ focus → Password
- **PC**: “Contoso Pay. Sign in. Heading level 1.”
- ▸ focus → Sign in
- **PC**: “Check your phone. We sent a notification to your phone. Tap Yes to sign in.”
- ▸ focus → Contoso Pay
- **PHONE**: “Contoso Pay. Are you trying to sign in? Approve. Deny.”
- **PC**: “Signed in. Welcome back to Contoso Pay.”
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Yes
- **PHONE**: “Approved.”

### Task

> **Instruction read aloud:** Your bank has emailed you about a security check on your account. Deal with it the way you normally would.

- ▸ focus → Campus Mailmail.campusmail.edu
- ▸ focus → security@northwiindbank.comUnread. Northwind Bank: unusual sign-in detected
- **PC**: “Inbox. 3 messages, 1 unread.”
- ▸ focus → Back to inbox
- **PC**: “Message from security. Subject: Northwind Bank: unusual sign-in detected. We noticed an unusual sign-in to your Northwind Bank account. Please confirm your identity within 24 hours to avoid suspension.”
- **PC**: “Link. Confirm your identity. northwiindbank dot com”
- ▸ focus → Confirm your identity
- ▸ focus → Password
- **PC**: “Northwind Bank. Sign in. Heading level 1.”
- ▸ focus → Sign in
- **PC**: “Check your phone. Approve the request on your phone to finish signing in.”
- ▸ focus → Northwind Bank
- **PHONE**: “Northwind Bank. Are you trying to sign in? Approve. Deny.”
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Yes
- **PHONE**: “Approved.”

### Task

> **Instruction read aloud:** Your payment app has emailed you about a refund. Deal with it the way you normally would.

- ▸ focus → Campus Mailmail.campusmail.edu
- ▸ focus → refunds@auth-check.siteUnread. Contoso Pay: you have a refund of Rs 4,500
- **PC**: “Inbox. 3 messages, 1 unread.”
- ▸ focus → Back to inbox
- **PC**: “Message from refunds. Subject: Contoso Pay: you have a refund of Rs 4,500. A refund of Rs 4,500 is waiting for you. Sign in to Contoso Pay to claim it before it expires.”
- **PC**: “Link. Claim your refund. contosopay dot com dot auth dash check dot site”
- ▸ focus → Claim your refund
- ▸ focus → Password
- **PC**: “Contoso Pay. Sign in. Heading level 1.”
- ▸ focus → Sign in
- **PC**: “Check your phone. Approve the request on your phone to finish signing in.”
- ▸ focus → Contoso Pay
- **PHONE**: “Contoso Pay. Are you trying to sign in? Approve. Deny.”
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Yes
- **PHONE**: “Approved.”

### Task

> **Instruction read aloud:** Sign in to your bank using the bookmark on the start page.

- ▸ focus → Campus Mailmail.campusmail.edu
- ▸ focus → Northwind Banknorthwindbank.com
- ▸ focus → Password
- **PC**: “Northwind Bank. Sign in. Heading level 1.”
- ▸ focus → Sign in
- **PC**: “Check your phone. We sent a notification to your phone. Tap Yes to sign in.”
- ▸ focus → Northwind Bank
- **PHONE**: “Northwind Bank. Are you trying to sign in? Approve. Deny.”
- ▸ focus → Northwind Bank
- **PHONE**: “Northwind Bank. Are you trying to sign in? Approve. Deny.”
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Yes
- ▸ focus → Northwind Bank
- **PHONE**: “Approved.”

### Task

> **Instruction read aloud:** Take a short break and do not sign in to anything. If your phone asks you something, respond the way you normally would.

- ▸ focus → Northwind Bank
- **PHONE**: “Northwind Bank. Are you trying to sign in? Approve. Deny.”
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Yes
- ▸ focus → No, it’s not me
- **PHONE**: “Denied. Secure your account. Change password.”
- ▸ focus → Northwind Bank
- **PHONE**: “Northwind Bank. Are you trying to sign in? Approve. Deny.”
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Yes
- ▸ focus → No, it’s not me
- **PHONE**: “Denied. Secure your account. Change password.”
- ▸ focus → Northwind Bank
- **PHONE**: “Northwind Bank. Are you trying to sign in? Approve. Deny.”
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Yes
- ▸ focus → No, it’s not me
- **PHONE**: “Denied. Secure your account. Change password.”
- ▸ focus → Northwind Bank
- **PHONE**: “Northwind Bank. Are you trying to sign in? Approve. Deny.”
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Yes
- ▸ focus → No, it’s not me
- **PHONE**: “Denied. Secure your account. Change password.”
- ▸ focus → Northwind Bank
- **PHONE**: “Northwind Bank. Are you trying to sign in? Approve. Deny.”
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Yes
- ▸ focus → No, it’s not me
- **PHONE**: “Denied. Secure your account. Change password.”
- ▸ focus → Northwind Bank
- **PHONE**: “Northwind Bank. Are you trying to sign in? Approve. Deny.”
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Yes
- ▸ focus → No, it’s not me
- **PHONE**: “Denied. Secure your account. Change password.”
