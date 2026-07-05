# NutriVoice 🎙🥗

**Live:** https://nutrivoice-arjunymuns-projects.vercel.app — on iPhone/Android: open in
Safari/Chrome → Share → **Add to Home Screen** (installs as an offline-capable app).
**Repo:** https://github.com/arjunymun/nutrivoice

Voice-first calorie tracker for **web, iOS and Android** from a single Expo codebase.
Say *“I had 200 grams of chicken breast with 200 grams of rice”* — NutriVoice parses it,
matches foods against a 328-item nutrition database (Indian food first-class), and logs
calories + macros. One account, synced everywhere.

## Features

- **Talk to log** — speech-to-text (Web Speech API on web, `expo-speech-recognition` on
  native dev builds) feeding a deterministic natural-language parser: quantities, units
  (g/kg/ml/cups/bowls/katori/pieces…), word numbers, multi-item sentences, Hindi aliases
  (dahi, roti, ghee…), fuzzy matching for misspellings. Review card before anything is saved.
- **Optional AI parse** — `parse-food` Supabase edge function calling Claude for messy
  sentences (needs `ANTHROPIC_API_KEY` secret; app works fully without it).
- **Barcode scanner** — live camera scanning on iOS/Android (expo-camera), manual barcode
  entry on web; data from Open Food Facts.
- **Search & manual entry** — fuzzy search, portion defaults, custom foods.
- **Bodybuilding-aware targets** — Mifflin-St Jeor BMR → TDEE, cut/maintain/bulk calorie
  goals, protein at 2 g/kg, BMI card, weight trend chart. All targets overridable.
- **Train module (Hevy-class)** — 171-exercise catalog with gym-slang aliases, voice set
  logging ("squats 5x5 at 100" → logged) **and** a full editable set grid (inline
  weight/reps/RPE, warmup/drop/failure set types, per-row previous-session ghosts),
  reorder / replace / remove exercises mid-session, **plate calculator**, routines,
  ✨ AI routine builder (free LLM), rest timer, deterministic double-progression hints,
  **per-exercise records screen** (best e1RM, heaviest, best volume + e1RM trend chart),
  **weekly muscle-group volume** (Hevy Pro-gated — free here), PR detection (Epley e1RM),
  repeat-a-past-workout, full offline + sync.
- **Adaptive TDEE** — MacroFactor's flagship, free: recalibrates your real calorie burn
  from weight trend + food logs (least-squares trend, partial-day filtering, clamped and
  confidence-blended). Suggests — never silently changes — your targets.
- **Offline-first sync** — everything works signed out (AsyncStorage); sign in (Supabase
  auth) to sync across devices. Last-write-wins on `updated_at`, soft deletes, RLS on every table.
- **Dark portfolio UI** — custom design system, SVG calorie ring, macro bars, charts, Inter.

## Repo layout

```
nutrivoice/            Expo app (expo-router v57, TypeScript, React Native 0.86)
  src/app/             routes: onboarding + tabs (today, log, stats, profile)
  src/components/      CalorieRing, MacroBar, MealSection, ParsedReview, BarcodePanel…
  src/lib/             parser, nutrition math, food search, speech, sync, Supabase client
  src/stores/          zustand stores (profile, log) persisted to AsyncStorage
  src/data/foods.json  328 foods, per-100g macros, Atwater-validated, Hindi aliases
supabase/migrations/   database schema (applied to the hosted project)
docs/superpowers/specs design spec
```

## Running

```bash
cd nutrivoice
npm install
npm run web       # web at http://localhost:8081
npm run android   # Expo Go or dev build
npm run ios       # needs macOS/EAS for builds; Expo Go for development
npm test          # parser + nutrition + dataset tests (jest-expo)
```

Voice on native requires a dev build (`npx expo run:android` or EAS) because
`expo-speech-recognition` isn't in Expo Go; the app detects this and falls back to typed
input. Web voice works in Chrome/Edge/Safari out of the box.

## Backend

Supabase project (ap-south-1): auth + Postgres (RLS) + `parse-food` edge function.
Client config in `src/lib/config.ts` uses the *publishable* key (safe to embed; RLS
protects data). Point at your own project with `EXPO_PUBLIC_SUPABASE_URL` /
`EXPO_PUBLIC_SUPABASE_KEY`. To enable AI parsing:
`supabase secrets set ANTHROPIC_API_KEY=sk-ant-…`.

## Store builds

`app.json` carries bundle ids (`com.arjun.nutrivoice`), camera/mic permission strings and
config plugins — `eas build -p android|ios` is all that's left (Apple/Play accounts required).

Nutrition values compiled from USDA FoodData Central and IFCT reference data; packaged
foods from Open Food Facts. Estimates — not medical advice.
