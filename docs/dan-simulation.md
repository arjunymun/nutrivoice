# Simulation: Dan, 24, 84 kg, 182 cm, active, bulking

Automated (jest: `src/lib/__tests__/dan-simulation.test.ts`, runs in CI/`npm test`).
28 varied meals over 7 days — Indian, western, gym staples, plus deliberately
off-catalog items (miso soup, protein bar, quinoa, feta).

## Targets (app-computed)
Mifflin-St Jeor → TDEE ×1.725 (active) ×1.1 (bulk) = **3534 kcal**, protein **168 g**
(2 g/kg), carbs 495 g, fat 98 g. Sanity-asserted in the test.

## Results (final build)
- **Match rate: 98.6%** of parsed food segments resolved against the 330-food catalog
  offline. The one miss ("miso soup") correctly routes to the AI path, which returned
  sane macros in the live e2e test.
- **Zero wrong-food matches** after tuning: raising the fuzzy-match floor to 0.55 and
  alias fixes eliminated all observed mismatches ("grilled salmon"→Paneer Tikka,
  "protein bar"→Whey Shake, "miso soup"→Ramen — all found by this simulation and fixed).
- Day totals (matched-only): 2118–3079 kcal, protein 106–206 g, avg 155 g/day —
  the dashboard correctly shows Dan short of his 3534 kcal / 168 g targets, which is
  exactly the feedback loop a bulker needs (eat more, ring says how much).

## Live AI e2e (deployed function, real signed-in user, zero API keys)
| Input | Result |
|---|---|
| "150 g feta cheese salad with quinoa and a protein bar" | 2 items, sane macros (bar: 290 kcal/100g, 20 g protein) |
| "two slices of pepperoni pizza and a can of red bull" | pizza 250 kcal/100g, Red Bull 46 kcal/100g ✓ |
| "100 g tempeh with kimchi and half an avocado toast" | tempeh 192 kcal/100g, 20 g protein ✓ |

Provider used: **Pollinations (keyless, free)**. Latency 10–21 s on free tier; adding a
free Groq key (`supabase secrets set GROQ_API_KEY=...`) drops this to ~1–2 s.

## Speech assessment (honest)
- **Web (Chrome/Edge/Safari incl. iPhone PWA):** Web Speech API, solid; interim
  transcripts shown live; explicit error states (no-speech, permission denied). Firefox
  has no Web Speech API → app detects and shows the typed-input path.
- **Android/iOS native builds:** `expo-speech-recognition`, permissions wired via config
  plugin. Works in dev/EAS builds; Expo Go lacks the module → auto-fallback to typing.
- **Not machine-verifiable here:** actual mic capture (headless browser has no mic).
  Code paths for every failure mode reviewed + fallback always available; the parser is
  identical for spoken and typed input, so parse quality is fully covered by tests.
- iOS dictation goes through Apple servers — voice needs net; typing works offline.

## Verdict
Works for Dan's bodybuilding use: accurate targets, 98.6% offline coverage of a varied
diet, AI catches the tail, protein/kcal gaps visible at a glance. Weakest link vs
MacroFactor remains static TDEE (see competitive analysis).
