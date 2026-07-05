# NutriVoice vs Cal AI vs MacroFactor vs Hevy (July 2026)

## Hevy (added after the Train module shipped, 2026-07-05)

**Where Hevy wins:** social feed/friends/leagues, Apple Watch + Wear OS apps, exercise
demo videos, years of polish, supersets/drop-sets UI.

**Where NutriVoice wins:**
- **Voice set logging** — "squats 5x5 at 100, bench 3x8 60" logs eight sets in one
  sentence; Hevy is tap-tap-tap per set.
- **AI routine builder on a free LLM** — natural-language goal → equipment-aware program;
  Hevy has templates only, and its analytics sit behind Hevy Pro.
- **Training + nutrition in ONE app** feeding **adaptive TDEE** — Hevy knows nothing about
  your diet; MyFitnessPal's exercise diary is burn-guesswork bolted onto diet; we close
  the loop: lift → eat → weigh → targets recalibrate.
- **Deterministic progression hints** (double progression + deload rules) for free.
- Full **web app** + offline; Hevy's web is Pro-gated.


Honest feature test. Sources at bottom.

## Where THEY beat us

| Capability | Cal AI | MacroFactor | NutriVoice today |
|---|---|---|---|
| **Photo logging** | Core feature — snap a meal, AI estimates macros (claims 90%; independent tests show 15–25% error, fails on complex meals) | Photo snapshots supported | ❌ None. Biggest visible gap. |
| **Adaptive TDEE** | ❌ | ⭐ Killer feature — reverse-computes your real TDEE from weight trend + intake, ±50–100 kcal after 2–3 weeks | Static Mifflin-St Jeor formula; weight is logged but doesn't feed back into targets |
| **Food database** | Smaller than competitors (a weakness for them too) | 1.15 M verified items, 54 micronutrients | 330 curated items + Open Food Facts barcodes + AI estimates; macros only, no micros |
| **Polish/ecosystem** | Apple Watch app, social groups, progress photos | Recipe import from URLs, coached diet phases | None of those |

## Where WE beat them

| Capability | NutriVoice | Them |
|---|---|---|
| **Voice-first logging** | Say a full mixed sentence → parsed, reviewed, logged; works on web too | Cal AI/MF have voice as secondary at best; photo can't hear "200 grams" — voice carries exact quantities, photos guess them |
| **Price** | Free, self-hosted, open code | Cal AI ~premium subscription; MacroFactor $71.99/yr, no free tier |
| **Indian food, first-class** | dahi/roti/ghee/sabzi/chaat native in DB + Hindi aliases + IFCT-consistent values | Western DBs; Cal AI notoriously weak on regional foods (misread an apple as tikka masala) |
| **Web app** | Full web version, installable PWA, offline-capable | Both are mobile-only |
| **Offline-first** | Full logging offline; syncs later | Cal AI photo logging requires connectivity |
| **Any-food AI on free LLM** | Keyless free provider chain; $0 to run | Their AI = paid subscription funding API costs |
| **Data ownership** | Your Supabase, RLS, exportable SQL | Their cloud |

## Verdict for the roadmap
1. **Adaptive TDEE is the highest-value gap** (MacroFactor's moat): we already collect weight + intake; the regression is pure math, no API costs. Best next feature.
2. **Photo logging** is the flashiest gap; feasible later via the same edge-function pattern with a vision model.
3. Micronutrients: skip for v1 — different product depth.

## Sources
- [Cal AI Review 2026 (nutrola)](https://nutrola.app/en/blog/cal-ai-review-2026)
- [Cal AI photo logging accuracy (askvora)](https://askvora.com/blog/cal-ai-acquisition-photo-food-logging)
- [Cal AI review (aumiqx)](https://aumiqx.com/ai-tools/cal-ai-app-review-nutrition-tracker-2026/)
- [MacroFactor review 2026 (best-nutrition-apps)](https://best-nutrition-apps.com/reviews/macrofactor/)
- [MacroFactor vs MyFitnessPal (macrofactor.com)](https://macrofactor.com/macrofactor-vs-myfitnesspal/)
- [MacroFactor expenditure docs](https://help.macrofactorapp.com/en/articles/26-how-should-i-interpret-changes-to-my-energy-expenditure)
