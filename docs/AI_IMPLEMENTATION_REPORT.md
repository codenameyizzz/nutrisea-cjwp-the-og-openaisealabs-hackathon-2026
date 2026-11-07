# NutriSea AI implementation report

Date: 7 November 2026. Repository: `nutrisea-cjwp-the-og-openaisealabs-hackathon-2026`, initial HEAD `95e1c04`. **This is a partial implementation, not a production-safety claim.** The required budget loop is verified through real FastAPI route handlers with isolated synthetic SQL fixtures; its complete signed-in browser/Clerk/Aiven journey is not verified.

## Preservation and audit

- Backup branch: `backup/pre-agentic-20261107-142354`. It protects HEAD, not uncommitted edits by itself.
- Uncommitted source snapshot and binary diff: `D:/Sea_Labs_Hackathon/.nutrisea-agentic-backups/20261107-142354` (53 source files). Database dumps, credentials and environments were excluded from source copying. Nothing was committed or reset.
- Other frontend/backend edits continued during the session. They remain intact; the repository-wide diff is not a list of changes attributable to this work.
- Historical reports found: `docs/AI_INTEGRATION_REPORT.md`, `docs/BACKEND_EVALUATION_REPORT.md`. `RAG_ARCHITECTURE_REPORT.md` was not found, including a repository filename search. Its contents were not invented.
- The initial and final F01-F12 matrices, exact function locations and evidence are in [AI_FEATURE_STATUS.md](AI_FEATURE_STATUS.md).

## Already present before this run

Clerk session verification; ownership protection for user/onboarding/merchant routes; atomic onboarding and merchant recipe updates; PostgreSQL user/profile/chat/memory/action/meal tables; explicit Indonesian food dislike/correction parsing; live-catalog preference recommendations with ID validation; frontend account bootstrap and manual shopping cart; persona scoring functions; NetworkX reference ontology; scanner provenance changes and tests. These are preexisting foundations, not newly implemented achievements. The baseline backend suite passed 95 tests.

## Changes made here

### Identity, confirmation and memory

`backend/app/api/chat.py`, `api/actions.py`, `api/graph.py`, `api/profile.py`, `api/users.py`, and new `services/profile_actions.py`:

- Chat/history/action/personal graph routes require the verified Clerk principal. Body/path identities cannot select another account. Graph projection uses the account's profile, not shared persona-node mutations. Legacy process-global profile switching returns 410.
- Supported explicit statements produce an opaque UUID proposal with old value, proposed value, provenance, status, scope and a 15-minute confirmation expiry. Only three validated decisions are accepted: permanent, today, reject. Unambiguous yes/no applies only with one active proposal.
- Pending actions live in the existing `user_action_log` JSON payload under reserved type `PROFILE_CHANGE`; public event logging cannot forge this type. PostgreSQL row locks serialize profile/action writes; stale old values and repeated confirmations fail explicitly. SQLite tests do not verify PostgreSQL lock behavior under contention.
- Permanent budget updates write `health_profile.meal_budget_idr`; food preferences reuse the existing explicit-preference memory source. Reduced-fried goal and confirmed ISO birth date use reserved keys in existing `learned_palate` JSON. Age is derived using Jakarta date logic on profile reads, without yearly LLM mutations. A DOB correction still does not independently recalculate every metabolic target until a normal profile recomputation; do not imply otherwise.
- Today overrides expire at the next Jakarta midnight and never overwrite the permanent value. `No rice today` cannot be saved permanently. New supported allergy statements apply a precaution for the current day pending confirmation. An expired confirmation does not silently clear that precaution before midnight. Rejecting the proposal clears its unconfirmed effect; confirmed allergies are never removed by behavioral evidence.
- Health proposals and raw personal notes check the existing consent flag; confirmation rechecks it. **Consent UX remains incomplete:** bootstrap/onboarding can default that flag true, and an account with consent false receives an explicit error rather than a temporary non-persisted allergy flow. Do not claim a complete consent lifecycle.
- `services/memory_extractor.py` no longer auto-writes model/regex-derived health facts. It retains a narrow preference candidate compatibility hook. Negation, third-party diagnosis and temporary habit examples cannot become durable health memories.
- Three `DISMISS_SUGGESTION` events within seven days provisionally switch chat to quiet advice. The health goal stays unchanged; the style returns to standard as evidence ages out. This is deterministic aggregation, not an LLM auditor. Events can still repeat; richer deduplication and clarification cooldown remain TODO.
- Owned derived-note deletion is available at `DELETE /api/users/{user_id}/memories/{memory_id}`. It does not delete canonical allergies or explicit preferences. A user-facing forget panel is not implemented.

### Catalog, rules and recommendation safety

`backend/app/api/preferences.py`, `api/recommend.py`, `api/recalibrate.py`, `api/dishes.py`, `ai/planner.py`, `ai/prompts.py`, `services/recommendation_scorer.py`, `services/knowledge_graph.py`:

- Homepage suggestions, chat suggestions, lunch, swaps, graph recommendations and the legacy recalibration suggestion call the same authenticated live-catalog recommendation function. It checks availability/open merchant/outlet, current allergies, scoped budget and food exclusions, then uses existing persona/budget/goal/nutrition scoring with stable variance. Reduced fried food changes soft ordering without deleting behavioral history.
- Empty candidate sets remain empty. Unknown entities are not substituted. The planner's invented fallback dish, peanut-free claim, fabricated remaining calories and consumption claim were removed. Model IDs/names are matched back to server candidates; prices and nutrition always come from server rows.
- Every legacy catalog entry currently exposes `allergenCoverage: unknown`: a list of allergens is not proof of complete ingredients or cross-contact controls. For a user with an allergy, unknown coverage is withheld. This conservative behavior can yield **zero recommendations for all current dishes**. Merchant recipe editing exists but has no completeness attestation; do not mark recipes complete merely because some ingredient rows exist.
- Graph sodium/fat ceiling keys and document-level guideline source are normalized. Exact known IDs/names resolve; missing IDs yield UNKNOWN/is_safe false. Personal API responses do not claim clinical verification. Live recipe version linkage remains TODO; template clinical helpers remain reference code, outside the personal route.
- Free-form LLM prose remains prompted rather than formally constrained. Bounded read-only model tools, second-search planning, explicit merchant customization support, complete clinical validation and complete allergen provenance are not implemented.
- Structured diagnostics record candidate counts, selected ID, model/fallback state, rule version and latency without logging user message text. Provider calls have an eight-second timeout and no retry loop. Unknown/missing nutrition retains its source label; current schema supports TKPI/ESTIMATE/unavailable, not the entire proposed provenance taxonomy.
- Batched ORM relationship loading removed per-dish network queries. Read-only live request for 100 dishes improved from **17.03s** (over UI's 15s timeout) to **3.28s**. This is a single observed comparison, not a load benchmark.

### UI and continuity

`frontend/src/components/AiAssistantModal.tsx`, `components/NutriGraphVisualizer.tsx`, `context/AppContext.tsx`, `app/page.tsx`, `app/menu/[id]/page.tsx`:

- Existing chat layout retained; English confirmations offer **Update permanently / Just for today / Keep existing**, with scope and expiry text. The frontend no longer silently persists food preferences before sending chat.
- Chat fetches the account's whole stored conversation when opened; it renders the latest20, with upward scroll/show-older revealing earlier messages. Model context is a separate system message plus latest20 actual stored user/assistant messages, including the current message once. Browser history and role strings are ignored.
- Both floating chat and dish consultation authenticate and share the same stored conversation. Dish consultation still does not render proposal controls inline; proposals can be reviewed in the main assistant.
- Profile/preference events refresh homepage requests; homepage uses the server's eligible order rather than stale client scoring. Existing UI from concurrent work was retained. The homepage has a Not for me observation button; chat suppresses unsolicited dish suggestions in provisional quiet mode.
- Removed the shared browser short-term-memory cache from action logging. Observations are persisted under the server-authenticated account.
- The test CSS loader now handles ESM and tsx/CommonJS imports (`frontend/tests/register-css.mjs`, `tests/css-loader.mjs`). No global Node installation was changed.

### Food logs and commerce boundary

`backend/app/db/crud.py` uses Jakarta midnight for today's meal-log query. `api/recalibrate.py` no longer invents a meal or claim automatic dietary recalibration. Orders remain separate from confirmed meal logs. Log-grounded coaching/ranking is still incomplete.

**Agent cart actions are a proposal only and remain absent.** No assistant tool can add to cart, place an order, pay, or contact a restaurant. Manual checkout still has launch blockers: client-trusted prices/rewards, missing idempotency, multiple commits, entity substitution and incomplete eligibility checks. This task did not rewrite checkout. Raw browsing/manual cart/checkout do not yet share the recommendation allergy gate; do not call the overall application production-safe.

## Database and migration notes

The configured engine is PostgreSQL on an Aiven host. A fresh read-only `SELECT 1` succeeded during this run. Live anonymous chat-history and personal-graph requests returned401; catalog returned200. The pool now permits two steady connections plus one overflow per worker instead of ten plus twenty. Multiple workers still multiply that limit.

No migrations, schema DDL, dump, production profile edits or production personal-data copies were performed. Existing tables/JSON fields are reused. Journal growth needs a retention/indexing review; full-history fetch and action-journal scans are not yet bounded for long-lived accounts. Birth-date storage should eventually become a typed column with a reviewed migration.

Safe backup command to run **only after approving the destination and data-copy scope** (not executed here): configure a local `nutrisea_backup` libpq service using Aiven's verified host/CA, `sslmode=verify-full`, and a protected pgpass file; do not put credentials in shell arguments or commit the service/password file.

```powershell
pg_dump --dbname="service=nutrisea_backup" --format=custom --no-owner --no-acl --lock-wait-timeout=5s --file="D:\Backups\NutriSea\pre-agentic.dump"
```

Use an approved encrypted destination outside the repo. A schema-only inspection backup adds `--schema-only`; it does not back up personal records. A rollback of source should restore only this task's reviewed changes from the snapshot, not overwrite concurrent work. No automatic rollback command is provided because the tree contains other ongoing edits.

## Verification

| Check | Result | Scope/limitation |
|---|---|---|
| Baseline backend | 95 passed | Existing isolated SQLite suite |
| Final backend | 116 passed; 0 failures/errors/skips | Real FastAPI handlers and SQL fixtures; Clerk principal overridden in integration tests |
| Baseline frontend on Node22.14 | 15 test files failed before execution | registerHooks missing; not feature assertions |
| Compatible runtime before loader fix | 49 passed, 3 component files failed | CSS/CommonJS interoperability |
| Final frontend on Node22.22.2 | 74 passed; 0 failures/skips | Existing service/component suite; does not prove new chat UI end-to-end |
| TypeScript | Passed | Latest UI integrations |
| git diff --check | Passed | Normal CRLF warnings only |
| Aiven SELECT1 | Succeeded | Read-only connectivity, not transaction contention |
| Live API auth/catalog | 401/401/200 | Anonymous history, graph, catalog |
| Real browser | Homepage live catalog rendered after query fix; signed-out chat prompts/input/send disabled | No authenticated session supplied; budget confirmation/reload/scroll journey unverified |

Commands (repo root for backend; frontend directory for npm):

```powershell
backend/.venv/Scripts/python.exe scripts/run_backend_tests.py
npm.cmd run typecheck
npx.cmd --yes --package node@22.22.2 node --import ./tests/register-css.mjs --import tsx --test src/services/*.test.ts src/components/auth/*.test.tsx src/components/ingredients/*.test.tsx src/components/merchant/*.test.tsx src/app/scanner/*.test.ts src/app/cart/*.test.ts src/app/bmi/*.test.ts
git diff --check
```

Backend output is saved locally at `backend/.venv/run-logs/agentic-backend-tests.txt`. Final homepage snapshot: `frontend/output/playwright/final-home.yml` (live dish names, prices and nutrition labels rendered; no browser console errors). Earlier Playwright snapshots are local under `frontend/.playwright-cli/`; they are not a substitute for an authenticated demo. Tests use synthetic data and no model credentials. No production build, load test, PostgreSQL race test or real-provider quality evaluation was run.

`backend/tests/test_agentic_profile.py` adds21 focused cases. It covers proposal/confirm/cancel/today, expiry, stale/replayed decisions, cross-user history/actions/memories/graph, reserved-action forgery, precautionary allergies, reduced-fried ranking, unknown dishes, history/provider context, dismissals/decay, today-only instructions, false health extraction, consent, DOB, model outage, empty swaps, rule loader, derived-note deletion and observations versus intake. Legacy tests asserting anonymous access, guessed IDs and automatic health extraction were updated to the safer contracts; they were not silently skipped. Existing auth/onboarding/merchant/preference/scanner suites still pass.

## Reproducible demo (pending authenticated browser verification)

1. Run backend on8000 and frontend on3000. Sign in with an authorized disposable demo account; complete onboarding. For the budget demo use no allergy restrictions, because unknown recipe coverage is intentionally withheld for allergy users.
2. Set a starting budget of Rp30,000 using the existing profile form. Ensure the live catalog has at least one open/available item priced between Rp30,001 and Rp60,000; otherwise the candidate set cannot expand, although the budget reason still changes. Do not fabricate a live menu for the demo.
3. Open **Ask NutriSea**, send `My lunch budget is now Rp60,000`. Confirm that the card shows old30000/new60000. Before confirmation the canonical budget must remain30000.
4. Choose **Update permanently**. The confirmation endpoint returns an applied action; the canonical profile becomes60000. Close the drawer and inspect the refreshed homepage budget reason and expanded candidate list. A different top dish is not guaranteed if the original dish still ranks best.
5. Send another budget statement and choose **Keep existing**; verify no profile change. Repeat with **Just for today**; current recommendations use that budget, permanent profile remains60000, and the override expires at midnight WIB.
6. Send `I'm trying to eat less fried food`; soft ordering changes immediately pending save without erasing past clicks/cart observations. Send `I'm allergic to shrimp`; all unknown-composition dishes are withheld immediately, and saving permanently still requires confirmation.
7. Reload/reopen chat: recent20 should appear; scroll upward for older messages. Dismiss three suggestions with **Not for me**, then send a general chat message: quiet mode suppresses unsolicited dish suggestions without changing the health goal.

For an isolated, deterministic version of the budget scenario, run the verified full backend command above and inspect `test_agentic_profile` cases. Its fixtures include an available Rp20,000 fried dish and Rp55,000 steamed dish.

## Remaining blockers and next three priorities

1. Complete the signed-in Clerk/Aiven browser journey on a disposable account; add UI regression coverage and PostgreSQL concurrent-confirmation tests. Finish consent opt-in/revocation, precautionary behavior without storage consent, expiry visibility and deletion controls.
2. Establish merchant recipe completeness/allergen provenance and shared eligibility at manual checkout; repair authoritative pricing, idempotent rewards and atomic checkout before any agentic commerce or launch.
3. Add bounded read-only catalog tools and selective memory auditing with provenance, deduplicated dismissals, clarification cooldown and context retention limits. Keep general LLM prose distinct from validated purchasable recommendations.
