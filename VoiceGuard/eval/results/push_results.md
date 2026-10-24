# Push-abuse evaluation results

Generated with `node eval/push-eval.js`.

## Checks

- PASS: Baseline: attacker push hides the victim push whenever it arrives second
- PASS: VoiceGuard: concurrency warning for every race while the victim request is still pending
- PASS: VoiceGuard: a spoofed device defeats context details alone (code word still differs)
- PASS: Fatigue: warned and locked by the 3rd push at intervals of 5 s to 5 min
- PASS: Fatigue limitation: a very slow drip (one push every 15 min) is not detected
- PASS: Normal single sign-in: no warnings, not locked
- PASS: User retries after a timeout: no concurrency warning
- PASS: Adaptive expiry always leaves time to hear the warning twice plus 30 s

## Concurrent login

| delayS | spoofedDevice | baselineShows | guardShows | concurrencyWarning | newDeviceWarning | distinguishableByContextOnly | codeWordMismatch |
|---|---|---|---|---|---|---|---|
| 0 | false | attacker | 2 | true | true | true | true |
| 0 | true | attacker | 2 | true | false | false | true |
| 1 | false | attacker | 2 | true | true | true | true |
| 1 | true | attacker | 2 | true | false | false | true |
| 2.5 | false | attacker | 2 | true | true | true | true |
| 2.5 | true | attacker | 2 | true | false | false | true |
| 5 | false | attacker | 2 | true | true | true | true |
| 5 | true | attacker | 2 | true | false | false | true |
| 10 | false | attacker | 2 | true | true | true | true |
| 10 | true | attacker | 2 | true | false | false | true |
| 30 | false | attacker | 2 | true | true | true | true |
| 30 | true | attacker | 2 | true | false | false | true |
| 60 | false | attacker | 2 | true | true | true | true |
| 60 | true | attacker | 2 | true | false | false | true |

## Fatigue

| intervalS | userDenies | firstWarnedPush | approveLockedFromPush |
|---|---|---|---|
| 5 | true | 3 | 3 |
| 5 | false | 3 | 3 |
| 10 | true | 3 | 3 |
| 10 | false | 3 | 3 |
| 30 | true | 3 | 3 |
| 30 | false | 3 | 3 |
| 60 | true | 3 | 3 |
| 60 | false | 3 | 3 |
| 90 | true | 3 | 3 |
| 90 | false | 3 | 3 |
| 300 | true | 3 | 3 |
| 300 | false | 3 | 3 |
| 900 | true | — | — |
| 900 | false | — | — |

## Listening time and expiry by speech rate

| rate | baselineWords | baselineListenS | guardWords | guardListenS | guardExpiryS | fixedExpiryS |
|---|---|---|---|---|---|---|
| 0.75 | 10 | 4.4 | 57 | 25.3 | 81 | 60 |
| 1 | 10 | 3.3 | 57 | 19 | 68 | 60 |
| 1.25 | 10 | 2.7 | 57 | 15.2 | 60 | 60 |
| 1.5 | 10 | 2.2 | 57 | 12.7 | 60 | 60 |
| 2 | 10 | 1.7 | 57 | 9.5 | 60 | 60 |
