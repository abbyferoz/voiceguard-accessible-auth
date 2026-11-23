# Push-guard ablation

Generated with `node eval/ablation-eval.js`. Each row switches off one component of the push guard and replays
the same scenarios: 7 concurrent-login races (attacker 0, 1, 2.5, 5, 10, 30, 60 s after the victim), with and without a
spoofed device; 12 fatigue schedules (one push every 5, 10, 30, 60, 90, 300 s, user denies or ignores);
expiry at speech rates 0.75, 1, 1.25, 1.5, 2×; and two normal sign-ins. "Sound different" compares the two spoken announcements
after removing the request number and age. Keeping every push visible (no override) is part of the VoiceGuard
interface and is not switched off here.

| Configuration | Pushes sound different (spoofed device) | Pushes sound different (other device) | Warned of second request (spoofed) | New-device warning (other device) | Approve locked by 3rd spam push | Expiry at 1.0× / 0.75× | False alarms on normal use |
|---|---|---|---|---|---|---|---|
| Full VoiceGuard | 7/7 | 7/7 | 7/7 | 7/7 | 12/12 | 68 s / 81 s | 0 |
| Without context | 7/7 | 7/7 | 7/7 | 0/7 | 12/12 | 62 s / 73 s | 0 |
| Without codeWord | 0/7 | 7/7 | 7/7 | 7/7 | 12/12 | 60 s / 69 s | 0 |
| Without concurrency | 7/7 | 7/7 | 0/7 | 7/7 | 12/12 | 60 s / 60 s | 0 |
| Without fatigue | 7/7 | 7/7 | 7/7 | 7/7 | 0/12 | 68 s / 81 s | 0 |
| Without adaptiveExpiry | 7/7 | 7/7 | 7/7 | 7/7 | 12/12 | 60 s / 60 s | 0 |
| Without codeWord and context | 0/7 | 0/7 | 7/7 | 0/7 | 12/12 | 60 s / 61 s | 0 |
| All components off | 0/7 | 0/7 | 0/7 | 0/7 | 0/12 | 60 s / 60 s | 0 |

## What is lost without each component

- **Without context:** no "new device" warning and no spoken device or city, so without a code word an attacker on another device sounds like the user.
- **Without codeWord:** with a spoofed device, the two pushes sound the same in 7 of 7 races.
- **Without concurrency:** no warning about the second request in 7 of 7 spoofed races.
- **Without fatigue:** Approve locked by the 3rd spam push in 0 of 12 schedules (full: 12).
- **Without adaptiveExpiry:** expiry too short to hear the request twice plus 30 s at rate 0.75× (60 s for 25.3 s of speech), 1× (60 s for 19 s of speech).
- **Without codeWord and context:** with a spoofed device, the two pushes sound the same in 7 of 7 races; even with a different device, the pushes sound the same in 7 of 7 races; no "new device" warning and no spoken device or city, so without a code word an attacker on another device sounds like the user.
- **All components off:** with a spoofed device, the two pushes sound the same in 7 of 7 races; even with a different device, the pushes sound the same in 7 of 7 races; no warning about the second request in 7 of 7 spoofed races; no "new device" warning and no spoken device or city, so without a code word an attacker on another device sounds like the user; Approve locked by the 3rd spam push in 0 of 12 schedules (full: 12).

## Domain warning

With the look-alike link warning off, the listener hears the baseline reading: 21.4% of the 1,114 look-alikes sound identical to the real domain,
and mean spoken similarity is 68.8% instead of 49.1% (see phishing_results.md).
