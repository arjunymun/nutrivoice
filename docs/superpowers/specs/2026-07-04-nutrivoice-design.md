# NutriVoice — Voice-First Calorie Tracker (Design Spec)

Date: 2026-07-04
Status: Approved by user in advance ("build the entire thing, then we can talk more").
User skipped the Q&A phase; all decisions below are recorded assumptions, revisable after v1.

## 1. Goal

Portfolio-quality calorie tracking app for **web + iOS + Android**, one account, synced.
Core loop: user *speaks* ("I had 200 grams of chicken breast with 200 grams of rice"),
app parses it, matches foods, logs calories + macros. Also: barcode scanning, manual
search/entry, body metrics (BMI, BMR/TDEE, bodybuilding-oriented targets), history charts.

Inspiration (from Cal AI / MyFitnessPal / MacroFactor class of apps): calorie ring
dashboard, macro bars, streaks, quick-add, per-meal grouping, weight trend.

## 2. Chosen approach (vs alternatives)

**Chosen: Single Expo (React Native) codebase → iOS + Android + Web** via react-native-web.
- One codebase, three platforms; user is on Windows so iOS binary builds go through EAS cloud later — code is iOS-ready.
- Alternatives rejected: Flutter (weaker web story for this stack, no JS reuse of parser);
  separate native apps + web app (3x effort, sync drift); PWA-only (no reliable native
  barcode/speech, weak portfolio story for "iOS/Android app").

**Backend: Supabase** (project `nutrivoice`, id `jqxqzhqzbiycjqjcllwd`, ap-south-1, free tier).
- Email/password auth, Postgres with RLS, edge function for AI parsing.
- Alternative rejected: Firebase (no SQL, weaker RLS story); custom server (overkill).

**Offline-first**: all logging works signed-out against local storage; signing in syncs
to Supabase (push local → pull remote, last-write-wins by `updated_at`).

## 3. Architecture

```
D:\Calories app\
  docs/superpowers/specs/        this spec
  nutrivoice/                    Expo app (expo-router, TypeScript)
    app/                         routes
      _layout.tsx                theme + providers
      onboarding.tsx             profile wizard (sex, age, height, weight, activity, goal)
      (tabs)/today.tsx           dashboard: calorie ring, macro bars, meals list
      (tabs)/log.tsx             logging hub: Talk | Search | Scan
      (tabs)/stats.tsx           weekly kcal/macros charts, weight trend, BMI card
      (tabs)/profile.tsx         profile, targets, account/sync, sign in/up
      scan.tsx                   barcode scanner (expo-camera) modal
    src/
      theme/                     design tokens (dark, portfolio-grade)
      components/                CalorieRing, MacroBar, MealSection, FoodRow, charts…
      data/foods.json            bundled nutrition DB (~300+ foods, per-100g, aliases)
      lib/parser.ts              deterministic NL food parser
      lib/foodSearch.ts          fuzzy search over foods.json + custom foods
      lib/nutrition.ts           BMI, Mifflin-St Jeor BMR, TDEE, goal targets
      lib/openFoodFacts.ts       barcode → product (Open Food Facts public API)
      lib/speech.ts              Web Speech API (web) / expo-speech-recognition (native, dev build) / text fallback
      lib/supabase.ts            client (publishable key — safe to embed)
      lib/sync.ts                offline-first sync engine
      stores/                    zustand stores (profile, log), AsyncStorage persistence
  supabase/migrations/           SQL kept in repo (applied via MCP)
```

## 4. Data model

Local + remote share shapes. Remote (Postgres, all RLS `auth.uid() = user_id`):

- `profiles` (user_id PK, name, sex, birth_year, height_cm, weight_kg, activity_level,
  goal [cut|maintain|bulk], target_kcal, target_protein_g, target_carbs_g, target_fat_g, updated_at)
- `food_logs` (id uuid PK client-generated, user_id, logged_at date, meal [breakfast|lunch|dinner|snack],
  food_id nullable, name, grams, kcal, protein_g, carbs_g, fat_g, source [voice|search|barcode|manual|ai],
  created_at, updated_at, deleted boolean)
- `custom_foods` (id uuid, user_id, name, per-100g macros, barcode nullable, updated_at, deleted)
- `weight_logs` (id uuid, user_id, logged_at date, weight_kg, updated_at, deleted)

Soft deletes (`deleted` flag) so sync can propagate removals.

## 5. Food data

`foods.json`: ~300+ entries. Fields: id, name, aliases[] (incl. Hindi/Indian names —
dahi, paneer, roti, ghee…), category, per-100g kcal/protein/carbs/fat, default_portion_g,
portion_label. Values sourced from USDA FoodData Central + IFCT knowledge; every entry
validated against Atwater arithmetic (kcal ≈ 4P + 4C + 9F ± 15%). Indian staples first-class:
curries, dals, rotis, ghee, dahi, sabzis, sweets.

## 6. Voice + parsing

Two-tier:
1. **Deterministic parser** (always available, offline): tokenizes transcript, grammar
   `quantity unit? food (and|with|plus|,) …`, unit table (g, gram, kg, ml, oz, cup, bowl,
   piece, slice, egg…), fuzzy match against aliases (normalized Levenshtein), portion
   defaults when no quantity given ("an egg" → 1 × 50 g). Returns structured items with
   confidence; UI shows review card before committing.
2. **AI parse (edge function `parse-food`)**: optional upgrade path; Claude API key as
   Supabase secret; handles messy input ("2 rotis and a small bowl of dal"). Client falls
   back to tier 1 on any failure. v1 ships with tier 1 as primary.

Speech-to-text: web = Web Speech API; native = expo-speech-recognition (works in dev
builds; in Expo Go gracefully falls back to typing the same sentence — parser identical).

## 7. Nutrition math

- BMI = kg/m². BMR = Mifflin-St Jeor. TDEE = BMR × activity factor (1.2–1.9).
- Targets: cut −20% TDEE, maintain, bulk +10%. Protein 2 g/kg (bodybuilding default),
  fat 25% kcal, carbs remainder. User can override all targets manually.

## 8. Error handling

- Parser: unmatched food → item flagged, user picks from suggestions or manual entry; never silently dropped.
- Barcode: product not found → offer manual/custom food creation. Network errors surfaced with retry.
- Sync: per-row upsert, last-write-wins on `updated_at`; failures queue and retry; app fully usable offline.
- All user input validated (grams > 0, sane ranges on profile numbers).

## 9. Testing

Jest (jest-expo): parser unit tests (quantities, units, multi-item, aliases, fuzzy),
nutrition math tests (known BMR/TDEE fixtures), foods.json validation test (schema +
Atwater check). Manual verification on web build (screenshots) before done.

## 10. UI direction

Dark, modern, portfolio-grade: near-black background, one accent (lime/green family),
large numeric typography for kcal, SVG calorie ring, macro progress bars, card-based meal
sections, subtle haptics on native. No template look.

## 11. Out of scope v1

Photo-based food recognition, social features, Apple Health/Google Fit integration,
push notifications, iOS App Store submission (needs Apple account; codebase EAS-ready).
