# VoiceGuard — blind-user session transcript (VoiceGuard)

| | |
|---|---|
| Condition | VoiceGuard (protections on) |
| Participant ID | P02 (synthetic) |
| Block / brand set | 1 / A (Northwind Bank, Contoso Pay) |
| Voice mode | "My screen reader" — announcements go to the ARIA live regions |
| Input | keyboard only (Tab / Enter / typing) |
| App | http://localhost:3100 (isolated instance, `DATA_DIR=data/blind-user-test`) |
| Recorded | 23/11/2026, 8:08:49 pm |

Every line below is what the app actually said, read from the app's own
"Spoken output" panel. `PC` is the participant's computer, `PHONE` is the phone.
`▸ focus` lines are where keyboard focus moved, which is what a screen reader
announces about the control.

## Task outcomes (scored by the app itself)

| Task | Outcome | Detail | Warnings heard | Decision time |
|---|---|---|---|---|
| `legit_email` | legit_success | signed_in | 0 | 2078 |
| `legit_login` | legit_success | signed_in | 0 | 2072 |
| `phish_typo` | resisted | went_back_from_warning;reported | 2 | 1801 |
| `phish_subdomain` | resisted | went_back_from_warning;reported | 2 | 1800 |
| `concurrent` | resisted | approved_own;reported | 1 | 4311 |
| `fatigue` | resisted | no_approval | 5 | 1459 |

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
- **PC**: “Verified site: mail dot campusmail dot edu. Inbox. 3 messages, 1 unread.”
- ▸ focus → Back to inbox
- **PC**: “Message from statements. Subject: Your Northwind Bank statement is ready. Your monthly statement for October is ready. Sign in to Northwind Bank to view it.”
- **PC**: “Link. View your statement. Goes to northwindbank dot com. Verified site.”
- ▸ focus → View your statement
- ▸ focus → Password
- **PC**: “Verified site: northwindbank dot com. Northwind Bank, sign in.”
- ▸ focus → Sign in
- **PC**: “Check your phone. Your code word is COFFEE. Again: COFFEE. Only approve a request that carries that code word. This request comes from Chrome on Windows, near Karachi.”
- ▸ focus → Northwind Bank
- **PHONE**: “Sign-in request for Northwind Bank. From Chrome on Windows, near Karachi, started just now. Code word: COFFEE. Approve only if you just signed in and the code word matches.”
- **PC**: “Signed in. Welcome back to Northwind Bank.”
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Approve
- **PHONE**: “Approved.”

### Task

> **Instruction read aloud:** Sign in to your payment app using the bookmark on the start page.

- ▸ focus → Campus Mailmail.campusmail.edu
- ▸ focus → Northwind Banknorthwindbank.com
- ▸ focus → Contoso Paycontosopay.com
- ▸ focus → Password
- **PC**: “Verified site: contosopay dot com. Contoso Pay, sign in.”
- ▸ focus → Sign in
- **PC**: “Check your phone. Your code word is MANGO. Again: MANGO. Only approve a request that carries that code word. This request comes from Chrome on Windows, near Karachi.”
- ▸ focus → Contoso Pay
- **PHONE**: “Sign-in request for Contoso Pay. From Chrome on Windows, near Karachi, started just now. Code word: MANGO. Approve only if you just signed in and the code word matches.”
- **PC**: “Signed in. Welcome back to Contoso Pay.”
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Approve
- **PHONE**: “Approved.”

### Task

> **Instruction read aloud:** Your bank has emailed you about a security check on your account. Deal with it the way you normally would.

- ▸ focus → Campus Mailmail.campusmail.edu
- ▸ focus → security@northwiindbank.comUnread. Northwind Bank: unusual sign-in detected
- **PC**: “Verified site: mail dot campusmail dot edu. Inbox. 3 messages, 1 unread.”
- ▸ focus → Back to inbox
- **PC**: “Message from security. Subject: Northwind Bank: unusual sign-in detected. We noticed an unusual sign-in to your Northwind Bank account. Please confirm your identity within 24 hours to avoid suspension.”
- **PC**: “Warning! Look-alike link. Confirm your identity. It goes to northwiindbank dot com, not northwindbank dot com. It has a double I, as in India, after T, H, W. This is likely a phishing site.” *(danger)*
- ▸ focus → Confirm your identity
- ▸ focus → Go back to safety
- **PC**: “Blocked. Look-alike website. Press Enter to go back to safety.” *(danger)*
- ▸ focus → Confirm your identity
- **PC**: “Warning. Look-alike link. It goes to northwiindbank dot com, not northwindbank dot com.” *(danger)*
- **PC**: “You stayed safe. Back on the previous page.”
- ▸ focus → Back to inbox
- **PC**: “Warning. Look-alike link. It goes to northwiindbank dot com, not northwindbank dot com.” *(danger)*
- ▸ focus → Confirm your identity
- ▸ focus → Report as phishing
- **PC**: “Reported as phishing and removed. Thank you.”

### Task

> **Instruction read aloud:** Your payment app has emailed you about a refund. Deal with it the way you normally would.

- ▸ focus → Campus Mailmail.campusmail.edu
- ▸ focus → refunds@auth-check.siteUnread. Contoso Pay: you have a refund of Rs 4,500
- **PC**: “Verified site: mail dot campusmail dot edu. Inbox. 3 messages, 1 unread.”
- ▸ focus → Back to inbox
- **PC**: “Message from refunds. Subject: Contoso Pay: you have a refund of Rs 4,500. A refund of Rs 4,500 is waiting for you. Sign in to Contoso Pay to claim it before it expires.”
- **PC**: “Warning! Look-alike link. Claim your refund. It goes to auth dash check dot site, not contosopay dot com. The name contosopay is only put at the front of the address to trick you. This is likely a phishing site.” *(danger)*
- ▸ focus → Claim your refund
- ▸ focus → Go back to safety
- **PC**: “Blocked. Look-alike website. Press Enter to go back to safety.” *(danger)*
- ▸ focus → Claim your refund
- **PC**: “Warning. Look-alike link. It goes to auth dash check dot site, not contosopay dot com.” *(danger)*
- **PC**: “You stayed safe. Back on the previous page.”
- ▸ focus → Back to inbox
- **PC**: “Warning. Look-alike link. It goes to auth dash check dot site, not contosopay dot com.” *(danger)*
- ▸ focus → Claim your refund
- ▸ focus → Report as phishing
- **PC**: “Reported as phishing and removed. Thank you.”

### Task

> **Instruction read aloud:** Sign in to your bank using the bookmark on the start page.

- ▸ focus → Campus Mailmail.campusmail.edu
- ▸ focus → Northwind Banknorthwindbank.com
- ▸ focus → Password
- **PC**: “Verified site: northwindbank dot com. Northwind Bank, sign in.”
- ▸ focus → Sign in
- **PC**: “Check your phone. Your code word is ROCKET. Again: ROCKET. Only approve a request that carries that code word. This request comes from Chrome on Windows, near Karachi.”
- ▸ focus → Northwind Bank
- **PHONE**: “Sign-in request for Northwind Bank. From Chrome on Windows, near Karachi, started just now. Code word: ROCKET. Approve only if you just signed in and the code word matches.”
- ▸ focus → Northwind Bank, request 1 of 2
- **PHONE**: “Sign-in request 2 of 2 for Northwind Bank. From Chrome on Windows, near Karachi, started just now. Code word: BRIDGE. Caution: 2 sign-in requests are waiting at the same time. Only one can be yours. Approve only the one whose code word matches your computer. Approve only if you just signed in and the code word matches.” *(danger)*
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Approve
- ▸ focus → Northwind Bank
- **PHONE**: “Approved. 1 more request waiting.”
- **PC**: “Signed in. Welcome back to Northwind Bank.”
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Approve
- ▸ focus → Deny
- ▸ focus → Report: this wasn’t me
- **PHONE**: “Reported. The request was blocked and your bank has been told.”

### Task

> **Instruction read aloud:** Take a short break and do not sign in to anything. If your phone asks you something, respond the way you normally would.

- ▸ focus → Northwind Bank
- **PHONE**: “Sign-in request for Northwind Bank. From Firefox on Linux, near Lahore, started just now. Code word: COFFEE. This request comes from a device you have not used before. Approve only if you just signed in and the code word matches.”
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Approve
- ▸ focus → Deny
- **PHONE**: “Denied.”
- ▸ focus → Northwind Bank
- **PHONE**: “Sign-in request for Northwind Bank. From Firefox on Linux, near Lahore, started just now. Code word: RIVER. Approve only if you just signed in and the code word matches.”
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Approve
- ▸ focus → Deny
- ▸ focus → Report: this wasn’t me
- ▸ focus → Repeat this request
- ▸ focus → 08:09:45 PM Sign-in request for Northwind Bank. From Firefox on Linux, near Lahore, starte
- ▸ focus → VoiceGuardPhone
- ▸ focus → Built-in voice My screen reader Both Silent (transcript only)
- ▸ focus → on
- ▸ focus → Read all waiting requests (1)
- **PHONE**: “1 sign-in request waiting.”
- **PHONE**: “Sign-in request for Northwind Bank. From Firefox on Linux, near Lahore, started just now. Code word: RIVER. Approve only if you just signed in and the code word matches.”
- ▸ focus → Stop reading
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Approve
- ▸ focus → Deny
- **PHONE**: “Denied.”
- ▸ focus → Northwind Bank
- **PHONE**: “Sign-in request for Northwind Bank. From Firefox on Linux, near Lahore, started just now. Code word: MANGO. Warning: 3 sign-in requests in the last 2 minutes, and 2 refused or missed in the last 10 minutes. Attackers send many requests to wear you down. Approve is locked for now. If you did not just sign in, choose Report.” *(danger)*
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Approve (locked)
- **PHONE**: “Approve is locked because of too many requests. If you are signing in yourself, wait a few minutes and try again. If not, choose Report.” *(danger)*
- ▸ focus → Deny
- **PHONE**: “Denied.”
- ▸ focus → Northwind Bank
- **PHONE**: “Sign-in request for Northwind Bank. From Firefox on Linux, near Lahore, started just now. Code word: TIGER. Warning: 4 sign-in requests in the last 2 minutes, and 3 refused or missed in the last 10 minutes. Attackers send many requests to wear you down. Approve is locked for now. If you did not just sign in, choose Report.” *(danger)*
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Approve (locked)
- **PHONE**: “Approve is locked because of too many requests. If you are signing in yourself, wait a few minutes and try again. If not, choose Report.” *(danger)*
- ▸ focus → Deny
- **PHONE**: “Denied.”
- ▸ focus → Northwind Bank
- **PHONE**: “Sign-in request for Northwind Bank. From Firefox on Linux, near Lahore, started just now. Code word: TIGER. Warning: 5 sign-in requests in the last 2 minutes, and 4 refused or missed in the last 10 minutes. Attackers send many requests to wear you down. Approve is locked for now. If you did not just sign in, choose Report.” *(danger)*
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Approve (locked)
- **PHONE**: “Approve is locked because of too many requests. If you are signing in yourself, wait a few minutes and try again. If not, choose Report.” *(danger)*
- ▸ focus → Deny
- **PHONE**: “Denied.”
- ▸ focus → Northwind Bank
- **PHONE**: “Sign-in request for Northwind Bank. From Firefox on Linux, near Lahore, started just now. Code word: MANGO. Warning: 6 sign-in requests in the last 2 minutes, and 5 refused or missed in the last 10 minutes. Attackers send many requests to wear you down. Approve is locked for now. If you did not just sign in, choose Report.” *(danger)*
- ▸ focus → 🎤 Answer by voice
- ▸ focus → Approve (locked)
- **PHONE**: “Approve is locked because of too many requests. If you are signing in yourself, wait a few minutes and try again. If not, choose Report.” *(danger)*
- ▸ focus → Deny
- **PHONE**: “Denied.”
