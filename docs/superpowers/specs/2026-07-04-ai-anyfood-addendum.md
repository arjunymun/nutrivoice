# Addendum: AI any-food logging (2026-07-04)

User requirements (pre-approved, execute directly):
1. AI parsing must run on a **free** LLM — no paid key required to work.
2. Users can log **any food**, not just the 328-item catalog.
3. Validate vs Cal AI / MacroFactor; simulate bodybuilding user "Dan"; check speech + AI; then ship (git + Vercel) in one shot.

## Design

**Edge function `parse-food` v2** — provider chain, first configured wins:
`GROQ_API_KEY` (llama-3.3-70b) → `GEMINI_API_KEY` (gemini-2.0-flash) → `ANTHROPIC_API_KEY` (haiku) → **Pollinations.ai keyless** (default, free, no signup).
Interpretation note: "free local web hosted llm" read as *free hosted LLM, zero-config*;
browser-local LLM (WebLLM) rejected — 600 MB model download, unreliable mobile WebGPU.

**Response upgrade**: items now carry estimated per-100g macros
`{name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g}` so unknown foods are
loggable. Server sanitizes: clamps ranges, recomputes kcal from Atwater when the model's
arithmetic drifts >25%.

**Client**: AI items first try catalog match (score ≥ 0.8 → catalog wins, better data);
otherwise an ad-hoc `Food` (`id: ai-<slug>`, category `ai`) is built from AI macros and
flows through the normal review card → log pipeline (source `ai`). In the Talk tab, when
local parse leaves unmatched items and the user is signed in, AI resolution is offered for
exactly those items; matched items are never overwritten.

Trade-off accepted: AI parse stays behind sign-in (`verify_jwt`) to keep the endpoint
from being an open relay. Signed-out users keep the 328-food catalog + custom foods.

## Validation plan
- e2e: scripted test user (signup → SQL-confirm email → password sign-in → call function).
- Dan simulation: jest-driven week of varied meals vs bulk targets; report committed to docs/.
- Competitive matrix vs Cal AI + MacroFactor committed to docs/.
