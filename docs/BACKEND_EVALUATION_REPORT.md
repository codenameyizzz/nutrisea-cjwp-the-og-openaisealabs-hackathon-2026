# NutriSea Backend Evaluation Report

**Review date:** 7 November 2026
**Project:** `nutrisea-cjwp-the-og-openaisealabs-hackathon-2026`
**Repository base at review:** `95e1c04` — integrate merchant auth and onboarding with adaptive preferences
**Scope:** backend architecture, authentication, transactions, recommendations, AI memory, graph reasoning, health data, merchant operations, and operational readiness.

## 1. Executive assessment

The backend has useful foundations, especially its newer account authorization, atomic onboarding, merchant ownership checks, recipe editing, and explicit-preference recommendations. However, it is not ready for untrusted users or real financial transactions.

The most urgent issues are:

1. Older AI routes allow unauthenticated access to personal history and mutation of user/graph context.
2. Checkout accepts client-supplied prices, totals, and reward eligibility without authoritative validation.
3. Failed checkout can leave a confirmed order behind, and retries create duplicate rewarded orders.
4. Graph nutrient limits are not loaded because the rule-file schema does not match the loader.
5. Health-profile changes, stored memories, persona templates, and recommendation inputs can contradict each other.

The latest completed backend test run passed **94 tests, with zero failures, errors, or skips**. Additional targeted checks demonstrated defects outside that suite's coverage. Passing the existing tests does not establish that checkout, personal-data isolation, or graph constraints are complete.

The recommended next work is to strengthen those foundations and make existing features agree before adding more model providers, vector retrieval, or autonomous behavior.

## 2. Review method and limits

This report consolidates the preceding detailed evaluation into one file. It combines source inspection, the existing test suite, and supplemental in-process API checks.

- Tests used a separate SQLite database or an in-memory SQLite database.
- Supplemental API checks used synthetic users, merchants, dishes, and messages.
- External AI keys were disabled for the audit runs.
- No live PostgreSQL records were changed by the review.
- No application source changes were made as part of the evaluation or this report.
- The latest completed test run included changes present when that run loaded its tests.
- The workspace was being edited concurrently. Findings are a review snapshot, not a guarantee that every later edit is covered.
- Before writing this report, the key checkout, history, persona-context, graph-loader, and legacy recommendation locations were checked again.

SQLite tests do not establish PostgreSQL concurrency, locking, migration correctness, or production CHECK-constraint behavior. External authentication-provider availability, real model output quality, load behavior, and a complete browser journey were not validated by these tests.

The targeted audit probes were temporary checks, not additions to the permanent regression suite.

Local test artifacts from the latest completed run:

- [Detailed test output](../backend/.venv/run-logs/backend-audit-final-76v2aulu/test-results.txt)
- [Machine-readable summary](../backend/.venv/run-logs/backend-audit-final-76v2aulu/summary.json)

These artifacts are under the local virtual environment and are not intended to be committed. This report includes their essential results so it remains useful when shared separately.

## 3. Confirmed test observations

| Check | Observed behavior | Interpretation |
| --- | --- | --- |
| Existing backend suite | 94 tests passed; no failures, errors, or skips | Good existing coverage, but important gaps remain |
| Read chat history without authentication | HTTP 200; synthetic private message returned | Personal history is not consistently protected |
| Log an action without authentication | HTTP 200; action accepted for supplied user ID | User context can be polluted |
| Add a graph memory without authentication | HTTP 200 | Graph mutations lack equivalent authorization |
| Submit Rp1 checkout for a catalog dish priced at Rp30,000 | HTTP 200, CONFIRMED, Rp10,000 reward | Server trusts client commerce fields |
| Use an unavailable dish from another closed merchant | Accepted in the same checkout probe | Availability and merchant consistency are not enforced |
| Submit identical checkout twice | Two order IDs; reward granted again | No request-level idempotency |
| Submit duplicate item IDs within one order | HTTP 500; order count increased from two to three | Header committed before item insertion failed |
| Supply nonexistent merchant and dish IDs | HTTP 200; existing merchant/dish substituted | Invalid references silently change the order |
| Remove an allergy and change budget through profile API | Profile saved; old allergy and budget memories remained | Derived personal context is stale |
| Build chat context for a user without the template's condition | Template condition appeared | Persona attributes still become apparent user facts in chat |
| Load current graph | Five condition nodes, zero nutrient-limit nodes | Confirmed rule-loader mismatch |
| Reject every legacy recommendation candidate | Rejected candidate still reached planner | Empty filtering result restores the unfiltered catalog |
| Extract “Saya tidak alergi udang.” | Saved candidate meaning allergic to shrimp | Negation handling is incorrect |
| Extract “Ibu saya diabetes.” | Saved candidate meaning user has diabetes | Subject attribution is incorrect |
| Submit negative calories, negative portion, excessive confidence | Accepted by SQLite-backed API probe | Missing request validation; PostgreSQL may reject at the database instead |

The checkout and authorization results were observed through in-process API requests. The legacy recommendation result used a controlled candidate set and patched planner to inspect what the endpoint passed onward. The memory examples exercised the heuristic extractor directly.

## 4. Priority definitions

- **P0 / Critical:** fix before exposing the application to untrusted users or relying on transactions.
- **P1 / High:** materially affects correctness, user trust, or the core personalization flow.
- **P2 / Medium:** incomplete capability, scaling concern, or operational improvement after critical correctness work.

These priorities are engineering judgments based on the observed behavior and the application's intended use.

## 5. Detailed findings

### BE-01 — P0: Authorization is inconsistent across backend routes

**Current behavior**

The newer user/profile and merchant/admin routes use signed-session authorization and ownership checks. Older chat, action, and graph routes do not consistently apply those protections.

Unauthenticated requests returned synthetic chat history and accepted action and graph-memory writes.

**Impact**

A caller who knows or obtains a user identifier can access personal conversations or influence the context used by the assistant. A graph mutation can affect a shared persona's recommendations.

**Recommended change**

Derive personal identity from the authenticated principal. Require ownership checks for history, actions, chat, memory, and personal graph operations. Explicitly separate public food knowledge from user-specific information. Do not use shared demo identities for normal authenticated traffic.

**Acceptance criteria**

Anonymous requests cannot access personal history or mutate personal context. User A cannot read or update User B's records. Public catalog/knowledge routes remain intentionally public where appropriate.

Sources: [chat API](../backend/app/api/chat.py), [action API](../backend/app/api/actions.py), [graph API](../backend/app/api/graph.py), [existing authorization implementation](../backend/app/core/ingredient_auth.py).

### BE-02 — P0: Checkout trusts client prices and silently replaces invalid entities

**Current behavior**

The order endpoint accepts `total_idr`, item prices, quantities, and `is_healthy_pick` from the request. Order creation does not recompute the total from authoritative catalog prices.

It does not consistently enforce dish availability, open merchants/outlets, or the relationship between a dish and the requested merchant. Unknown merchant and dish IDs fall back to existing records.

A synthetic Rp1 order containing an unavailable Rp30,000 dish from another closed merchant was confirmed.

**Impact**

The order may have the wrong price, wrong merchant, or wrong item. Any UI-side validation can be bypassed by a direct request.

**Recommended change**

Accept item IDs, quantities, allowed customizations, and a voucher reference. Load authoritative records, validate eligibility, calculate the quote server-side, and reject invalid references. Preserve a price snapshot in the confirmed order.

**Acceptance criteria**

Changing browser-supplied prices cannot change the charged total. Unavailable items, closed outlets, invalid IDs, and inconsistent merchant/item combinations are rejected. Duplicate item lines are merged or explicitly rejected before persistence.

Sources: [order request and endpoint](../backend/app/api/users.py), [order creation](../backend/app/db/crud.py), [order-item model](../backend/app/models/order_item.py).

### BE-03 — P0: Rewards can be obtained from repeated or misclassified checkout

**Current behavior**

The client controls the healthy-pick flag. A successful order can immediately receive Rp10,000 cashback. Repeating the request creates a new order and another reward.

The reward table has a unique order ID, which protects against duplicate reward rows for one order. It does not prevent duplicate orders or establish that an eligible purchase was paid for or delivered.

The default reward reason says `HEALTHY_ORDER_DELIVERED`, although the checkout path creates a confirmed order.

**Impact**

Reward balances do not reliably represent eligible completed transactions.

**Recommended change**

Determine eligibility on the server. Tie reward issuance to a clearly defined order/payment milestone. Make checkout retries idempotent and support reversals for cancellations/refunds.

**Acceptance criteria**

A retried request returns the original order. Changing a request flag cannot manufacture eligibility. Failed or reversed orders cannot retain an inappropriate reward.

Sources: [checkout reward decision](../backend/app/api/users.py), [reward persistence](../backend/app/db/crud.py), [reward model](../backend/app/models/reward_ledger.py).

### BE-04 — P1: Order creation is not atomic

**Current behavior**

Order creation commits the order header before inserting order items. Rewards are committed separately.

The duplicate-item probe returned HTTP 500 while leaving an additional order in the database.

**Impact**

Failed checkout can leave confirmed orders without a valid item set. A client cannot reliably determine whether retrying will duplicate an order.

**Recommended change**

Validate the entire request before writing. Use a single transaction for the order and all related local ledger changes. Handle database exceptions with rollback and a consistent error response. When an external payment service is added, model its state explicitly rather than holding a database transaction open across a remote call.

**Acceptance criteria**

Injecting an item-insertion failure leaves no new order, item, reward, voucher redemption, or wallet movement. Retrying has a defined result.

Source: [create_order](../backend/app/db/crud.py).

### BE-05 — P1: Graph-rule loading does not match the stored rule schema

**Current behavior**

The loader expects `nutrient_ceilings_per_meal` and `guidelines_reference`. The supplied condition records instead contain fields such as `max_sodium_per_meal_mg` and a top-level `guidelines_source`.

The audit observed five condition nodes and zero nutrient-limit nodes. Ingredient/method edges can still load from the separate ontology; the entire graph is not empty.

Unknown-node branches return `is_safe=True` with an unknown severity. Entity resolution also includes default substitutions.

**Impact**

The graph can present reassurance without having evaluated the rule or entity the user intended.

**Recommended change**

Validate source files against an explicit schema. Normalize the available nutrient limits into the loader's contract, or update the loader to consume the actual format. Represent unknown evidence as unknown. Report exactly which rules were evaluated.

**Acceptance criteria**

Every declared supported limit produces an exercised check. Unknown dishes and users do not acquire default entities silently. Missing metadata cannot be labeled a passed check.

Sources: [graph engine](../backend/app/services/knowledge_graph.py), [condition rules](../backend/app/data/ontology/clinical_rules.json), [ingredient ontology](../backend/app/data/ontology/ingredient_ontology.json).

### BE-06 — P1: Profile changes do not invalidate conflicting memories

**Current behavior**

Updating a health profile changes structured fields but leaves older onboarding-generated facts in long-term memory. The audit removed an allergy and changed a budget; both previous values remained in memories.

The chat persona formatter also reads template conditions and allergens. The newer onboarding implementation correctly avoids copying template medical attributes into the health profile, but downstream chat does not consistently respect that distinction.

**Impact**

Different features can provide different answers about the same user's constraints. An explicit correction may not change the assistant's response.

**Recommended change**

Define an authoritative source for each field. Derived memories should reference that source or be invalidated when it changes. Separate explicit user facts, template suggestions, observed behavior, and model inferences.

**Acceptance criteria**

Profile corrections affect all relevant subsequent recommendations and chat replies. Template conditions never become confirmed user conditions merely through persona selection.

Sources: [profile API](../backend/app/api/users.py), [persona assignment](../backend/app/api/personas.py), [chat context](../backend/app/api/chat.py), [memory schema](../backend/app/models/user_memory.py).

### BE-07 — P1: General memory extraction misinterprets statements

**Current behavior**

The heuristic extractor turns negated allergy statements into positive allergy facts and another person's condition into the user's condition. Temporary kitchen requests can become habits.

Chat-extracted facts receive fixed confidence 0.92. The broader memory path lacks a complete confirmation, supersession, expiry, and correction lifecycle.

The newer explicit-food-preference parser is narrower and more cautious. It should not be confused with a fix to the separate general extractor.

**Impact**

Incorrect memories persist and can influence future replies. A confidence percentage can make unsupported inference look authoritative.

**Recommended change**

Extract subject, assertion/negation, time scope, source message ID, and confirmation status. Reject ambiguous candidates or ask for clarification where it materially affects the outcome. Replace conflicting values through explicit supersession rather than appending another fact.

**Acceptance criteria**

Negations, questions, third-party statements, quotations, and one-off requests do not become durable personal restrictions. Users can inspect, correct, and remove memories.

Sources: [general extractor](../backend/app/services/memory_extractor.py), [explicit preference service](../backend/app/services/explicit_preferences.py).

### BE-08 — P1: Recommendation paths enforce different policies

**Current behavior**

The authenticated preference endpoint uses live catalog data, filters availability/open status/budget, and validates the model's selected candidate. This is an improvement.

The legacy lunch endpoint still uses `safe_candidates or catalog`, restoring rejected candidates when none pass. Swap does not apply equivalent filtering.

The newer endpoint passes an empty medical-condition list and does not fully incorporate the user's calorie/protein targets, current intake, or broader goal. Deterministic fallback selects the first eligible candidate rather than a full goal-aware ranking.

**Impact**

The answer can change depending on which endpoint or UI surface is used. A preference change may affect one recommendation path but not another.

**Recommended change**

Create one backend eligibility and ranking service. All recommendations, swaps, chat suggestions, and final checkout validation should use its authoritative constraints. Keep soft preferences separate from mandatory restrictions.

**Acceptance criteria**

An all-forbidden catalog yields no suitable candidate. The same user and dish receive consistent eligibility decisions across endpoints. Goal changes alter ranking where relevant.

Sources: [legacy recommendations](../backend/app/api/recommend.py), [preference recommendations](../backend/app/api/preferences.py), [backend scorer](../backend/app/services/recommendation_scorer.py), [planner](../backend/app/ai/planner.py).

### BE-09 — P1: Recipe management does not feed allergy checks

**Current behavior**

Merchant recipe editing supports ingredient references, quantities, ownership, and version checks. Recommendation filters primarily use menu-level allergen strings and a few name keywords.

The merchant dish payload does not expose an allergen field, and recipe saves do not derive allergen metadata or refresh graph relationships.

**Impact**

A dish's recipe can contain relevant ingredients while the recommendation layer treats its empty allergen list as no detected conflict.

**Recommended change**

Connect canonical ingredients to allergen metadata and propagate recipe changes to eligibility inputs. Preserve whether composition is known, inferred, incomplete, or verified. Unknown composition should not be represented as confirmed absence.

**Acceptance criteria**

Adding a relevant ingredient changes the dish's eligibility for affected users. Missing metadata produces an explicit uncertainty policy.

Sources: [merchant dish API](../backend/app/api/merchant.py), [recipe service](../backend/app/services/ingredients.py), [recommendation filters](../backend/app/services/recommendation_scorer.py).

### BE-10 — P1: Financial and order lifecycle features remain partial

**Current behavior**

The backend records orders and rewards. It does not provide a complete wallet opening balance/debit/refund ledger, voucher eligibility/redemption lifecycle, or order cancellation/delivery/refund workflow.

Order status enum values exist, but a complete transition API was not found. An order-history CRUD helper exists without a corresponding complete customer order-management flow.

**Impact**

The shopping UI can imply a financial process that the backend does not fully account for. The earlier Rp200,000 starter wallet and restaurant-specific voucher requirements need authoritative backend implementation.

**Recommended change**

Implement wallet entries, voucher definitions and redemptions, order state transitions, history/detail endpoints, and refund/reward reversals. For a hackathon simulation, keep these rules internally consistent and clearly identify simulated payment.

**Acceptance criteria**

Each user receives the starter balance once. Spending cannot exceed available balance. Vouchers enforce ownership, restaurant eligibility, expiry, and usage limits. Cancellation/refund effects reconcile across order, wallet, voucher, and reward records.

Sources: [order model](../backend/app/models/order.py), [reward model](../backend/app/models/reward_ledger.py), [user API](../backend/app/api/users.py), [CRUD](../backend/app/db/crud.py).

### BE-11 — P1: Persistent conversation behavior is unfinished

**Current behavior**

Chat stores messages but uses the last five browser-supplied history entries for generation. The history endpoint returns the oldest fifty records. The main modal does not restore the full saved conversation.

History roles are accepted as arbitrary strings rather than reconstructed from trusted persisted records. User-derived strings are also interpolated into the system-context block.

**Impact**

Reloading or switching chat surfaces loses conversational continuity. Client-provided history can influence message roles and instructions.

**Recommended change**

Use one authenticated persistent conversation per user, restore saved history, and build the model's recent-message window server-side. Enforce allowed roles and treat retrieved content as data.

**Acceptance criteria**

The latest twenty messages render initially, upward scrolling reveals earlier messages, and model context follows an explicit twenty-message counting rule without duplicating the current question.

Sources: [chat API](../backend/app/api/chat.py), [chat model](../backend/app/models/chat_message.py), [chat modal](../frontend/src/components/AiAssistantModal.tsx).

### BE-12 — P2: Health history and planning are incomplete

**Current behavior**

Measurements overwrite the current profile. Meal APIs emphasize today's entries. The day boundary is UTC rather than the user's Jakarta day.

There is no dedicated measurement timeline or complete versioned future-meal-plan workflow. The recalibration endpoint returns a largely fixed suggestion and claims weekly balance without computing it.

Meal payloads accept insufficiently constrained nutrient values, portion factors, confidence, and enum-like strings. Invalid source/type strings may be normalized to defaults instead of rejected.

**Impact**

Users cannot reliably inspect progress, correct intake, or understand what a plan is based on. Invalid data can distort totals or become a database error.

**Recommended change**

Add dated measurements, goal history, date-range meal queries, corrections/deletions, explicit local-day handling, and versioned plans. Validate values before database access. Recalibration should use real intake, confirmed constraints, available meals, and the active plan.

**Acceptance criteria**

A meal near local midnight belongs to the correct day. A corrected entry updates totals. Invalid values return a validation error. An actual meal log changes the remaining plan through a reproducible calculation.

Sources: [health profile](../backend/app/models/health_profile.py), [meal model](../backend/app/models/meal_log.py), [meal/profile APIs](../backend/app/api/users.py), [daily query](../backend/app/db/crud.py), [recalibration](../backend/app/api/recalibrate.py).

### BE-13 — P2: AI request boundaries and output validation need strengthening

**Current behavior**

Several AI routes lack authentication, per-user quotas, and request-size bounds. Scanner input is an optional unconstrained base64 string. Chat history and action payloads also lack sufficiently explicit size/schema limits.

The inspected model client does not define a complete application-level latency/cost budget. Successful vision output is checked as a dictionary, but does not yet receive comprehensive domain-field validation.

The recent scanner edit correctly returns unavailable analysis when the input/model fails. That improvement should be preserved.

**Recommended change**

Add input-size/content validation, per-user rate limits, explicit model deadlines, bounded context/output policies, validated response schemas, and observable fallback modes. Move memory extraction to a durable worker when reliable retry/recovery becomes necessary.

**Acceptance criteria**

Invalid/oversized input is rejected before a paid call. Model timeouts produce a clear bounded failure. Malformed model fields cannot become trusted nutrition or transaction values.

Sources: [scan API](../backend/app/api/scan.py), [vision service](../backend/app/ai/vision.py), [model client](../backend/app/ai/client.py), [chat API](../backend/app/api/chat.py).

### BE-14 — P2: Consent and personal-data lifecycle are not enforced consistently

**Current behavior**

A consent field exists, but some account-creation paths set it true automatically. The extractor does not enforce a clear consent gate before deriving health-related facts. Extraction logs can include raw personal fact text.

There is no complete user-facing memory retention/correction/deletion workflow.

**Recommended change**

Make consent an explicit, auditable user action. Define what data may be stored or inferred under each setting. Add correction/deletion behavior that also invalidates summaries, cached context, and personal graph inputs. Minimize sensitive content in logs.

**Acceptance criteria**

Declining the relevant consent prevents the associated inference/storage behavior. Deleting a fact stops it from reappearing through stale derived context.

Sources: [account model](../backend/app/models/app_user.py), [account CRUD](../backend/app/db/crud.py), [extractor](../backend/app/services/memory_extractor.py).

### BE-15 — P2: Merchant intelligence contains demonstration values

**Current behavior**

Demand-insight endpoints read stored records or return fixed example counts and uplift claims. Nutrition estimation uses model output or keyword-based fallback values. The merchant dish model also contains demonstration-style defaults for ratings/sales.

No complete event-to-demand aggregation and outcome-measurement pipeline was found.

**Recommended change**

Separate measured data, merchant declarations, model estimates, and demo values. Define aggregation windows and eligible events. Do not describe projected uplift as measured impact.

**Acceptance criteria**

Every displayed count traces to a defined query/time window, and estimates are labeled with their source and limitations.

Sources: [merchant API](../backend/app/api/merchant.py), [admin API](../backend/app/api/admin.py), [menu model](../backend/app/models/menu_item.py).

### BE-16 — P2: Operational readiness and test coverage need expansion

**Current behavior**

The root route returns static status information rather than checking database/schema/graph readiness. CORS uses a wildcard despite an available configured-origin setting.

Some request paths load large collections and related records without a clear bounded retrieval strategy. Model-derived memories are all inserted into chat context rather than selected by relevance and token budget.

The SQLite ORM schema omits several constraints present in PostgreSQL SQL migrations. Consequently, an input accepted in isolated tests may fail in deployment at a different layer. The audit's negative-calorie result must be interpreted with this distinction.

**Recommended change**

Add readiness checks, configured CORS origins, consistent error responses, pagination, retrieval budgets, and query profiling. Extend regression tests with the confirmed failures and add PostgreSQL integration tests for constraints, transactions, and concurrent updates.

**Acceptance criteria**

Readiness fails when required infrastructure/schema is unavailable. Validation behavior is consistent before database writes. Deployment-specific transaction and constraint tests run against a disposable PostgreSQL database.

Sources: [application setup](../backend/app/main.py), [database configuration](../backend/app/core/database.py), [settings](../backend/app/core/config.py), [PostgreSQL schema](../backend/migrations/init_postgres.sql), [safe test runner](../scripts/run_backend_tests.py).

## 6. Existing strengths to preserve

| Component | What is already useful |
| --- | --- |
| Session verification | Signed-token checks, issuer/authorized-party checks, and permissions from verified metadata |
| Protected account endpoints | Ownership checks for user/profile operations |
| Onboarding | Account, explicit profile data, persona selection, and related memories share a transaction |
| Persona assignment | Reference biometrics and medical conditions no longer automatically become health-profile facts |
| Ingredient management | Merchant ownership enforcement, input checks, inactive-item rules, recipe versions, and conflict detection |
| Merchant applications | Reviewed approval flow, row locking, stale-update checks, and retryable access publication |
| Explicit preferences | Narrow parser, per-user persistence, and correction of the same preference slot |
| New recommendation endpoint | Live candidates, availability/budget filtering, and validation of selected model output |
| Scanner failure handling | Explicit unavailable state rather than fabricated analysis |
| Testing | An isolated test mode and a passing suite that can be expanded with the demonstrated failure cases |

The goal should be to reuse these patterns across older modules rather than maintain separate authorization, persistence, and recommendation conventions.

## 7. Recommended implementation sequence

| Stage | Work | Completion condition |
| --- | --- | --- |
| 1. Access and checkout | Protect personal AI routes; validate authoritative prices, entities, availability, and reward eligibility; make checkout atomic and idempotent; add regression tests | No cross-user context access, fabricated prices, duplicate retries, or partial checkout records |
| 2. Consistent personalization | Fix graph schemas and unknown states; use confirmed profile data; invalidate stale facts; improve extraction; share eligibility rules; connect recipes to allergens | A restriction or correction produces consistent decisions across relevant features |
| 3. Complete user journey | Restore chat history; finish wallet/voucher and order lifecycle accounting; add meal/measurement history and corrections; implement actual plan recalculation | Onboarding, recommendation, checkout, history, and adaptation form one traceable flow |
| 4. Reliability and scale | Add request/response bounds, model deadlines, quotas, durable jobs, readiness, observability, retrieval budgets, PostgreSQL tests, and measured merchant aggregates | Failures are bounded and observable; performance and consistency are tested under realistic conditions |

Semantic retrieval should follow demonstrated retrieval needs rather than precede the identity, data-contract, and transaction fixes.

## 8. Minimum additional regression coverage

The acceptance criteria in each finding should become permanent tests. In particular, cover:

- **Isolation:** anonymous history access, cross-user action/memory writes, and user-specific graph changes.
- **Commerce:** price tampering, closed merchants, unavailable or unknown items, duplicate requests, injected item-write failure, and cancellation/refund reconciliation.
- **Recommendations:** all candidates excluded, unknown graph entities, missing metadata, and boundary tests for every loaded nutrient rule.
- **Memory:** negation, third-party conditions, temporary requests, explicit corrections, and consent restrictions.
- **Continuity:** restored conversations, recipe-change propagation, corrected meal totals, and Jakarta midnight.
- **Validation/failure:** invalid nutrient/confidence values, malformed model results, unavailable models, and context-budget limits.

Test PostgreSQL constraints and concurrent transactions separately from the SQLite suite.

## 9. Final evaluation

The newer account, onboarding, recipe, and preference components are a useful base. The priority is to bring older routes up to the same standard and connect them into one consistent flow. Treat the confirmed failures in this report as regression requirements before using the backend for real users or financial activity.
