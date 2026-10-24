# Phishing evaluation results

Generated 2026-10-24T15:43:02.060Z with `node eval/phishing-eval.js`.

- Trusted domains: 50. Generated look-alikes: 1114. Legitimate non-trusted domains: 85.
- Detection rate: **99.6%**. Correct real site named: **99.6%**.
- False-alarm rate on legitimate domains: **0.0%** (none).
- Mean spoken similarity, real vs fake: screen reader today **68.8%**, VoiceGuard **48.2%**.
- Look-alikes that sound identical today: **21.4%**.
- Listening time: VoiceGuard's difference sentence 4.1 s (full warning 10.6 s) vs 5.0 s to spell the whole address.

## Paper examples

| Real | Fake | Similarity today | Similarity with VoiceGuard | VoiceGuard says |
|---|---|---|---|---|
| bankofamerica.com | bankoffamerica.com | 100.0% | 60.4% | Warning! Look-alike link. It goes to bankoffamerica dot com, not bankofamerica dot com. It has a double F, as in Foxtrot, after N, K, O. This is likely a phishing site. |
| wellsfargo.com | wellssfargo.com | 100.0% | 59.5% | Warning! Look-alike link. It goes to wellssfargo dot com, not wellsfargo dot com. It has a double S, as in Sierra, after E, L, L. This is likely a phishing site. |

## By technique

| Technique | n | Detected | Right target | Sounds identical today | Similarity today | Similarity VoiceGuard | Diff (s) | Spell (s) |
|---|---|---|---|---|---|---|---|---|
| repetition | 128 | 99.2% | 99.2% | 98.4% | 99.4% | 53.5% | 3.8 | 4.2 |
| omission | 122 | 99.2% | 99.2% | 0.8% | 60.7% | 45.5% | 3.8 | 3.6 |
| transposition | 112 | 100.0% | 100.0% | 0.0% | 46.8% | 45.3% | 3.0 | 4.0 |
| substitution | 139 | 98.6% | 98.6% | 0.0% | 52.9% | 41.7% | 5.0 | 3.8 |
| homoglyph | 106 | 100.0% | 100.0% | 0.0% | 53.1% | 52.7% | 3.6 | 4.2 |
| homoglyph-unicode | 111 | 100.0% | 100.0% | 100.0% | 100.0% | 54.5% | 3.0 | 3.9 |
| tld-swap | 123 | 100.0% | 100.0% | 0.0% | 77.9% | 51.3% | 4.4 | 3.9 |
| combosquat | 123 | 100.0% | 100.0% | 0.0% | 73.1% | 55.5% | 2.3 | 6.2 |
| brand-in-subdomain | 150 | 100.0% | 100.0% | 0.0% | 57.8% | 37.9% | 7.0 | 9.8 |

Missed: hbbl.com (repetition of hbl.com), hl.com (omission of hbl.com), hvl.com (substitution of hbl.com), hnl.com (substitution of hbl.com)
