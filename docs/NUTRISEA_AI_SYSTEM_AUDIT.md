# NutriSea audit — current working tree

## Executive summary

**NutriSea currently has a limited, confirmation-based personalization pipeline. It does not yet have the complete adaptive, tool-using, memory-auditing AI system described in the product objective.**

The strongest current connections are authenticated chat history, live-database catalog selection, explicit preference/profile proposals, confirmation controls, and recommendation refreshes. These are present in code; **none was verified end to end during this audit**. The ordinary chat path uses fixed retrieval followed by a model call, rather than an agent choosing tools. The memory auditor is disconnected. (`backend/app/api/chat.py:36–113`; `backend/app/api/preferences.py:38–91`; `backend/app/services/memory_extractor.py:66–80`.)

The egg incident exposes a real gap: **both exact user messages fail the current structured-change parser**. Consequently, that path can save conversation text without creating an allergy proposal or canonical restriction. An unrelated catalog suggestion is appended by server formatting whenever a candidate exists, regardless of conversational intent. (`backend/app/services/profile_actions.py:39–65`; `backend/app/api/chat.py:61–110`.)

Current allergy recommendations fail closed: every serialized dish has unknown allergen coverage, so an account with an effective allergy receives no eligible recommendations. However, ordinary browsing, cart addition, and order creation do not enforce the same restriction. This is incomplete protection across the application. (`backend/app/api/dishes.py:59–60`; `backend/app/services/recommendation_scorer.py:30–45`; `backend/app/db/crud.py:426–497`.)

Other material defects include consent being reset by account synchronization, stale temporary allergy restrictions after profile edits, client-controlled order pricing and non-atomic checkout, and incompatible scanner output/logging contracts. Evidence and proposed priorities follow.

## Scope, evidence standard, and parallel investigation

Audited repository:

`D:\Sea_Labs_Hackathon\nutrisea-cjwp-the-og-openaisealabs-hackathon-2026`

Git inspection identified branch `fix/adaptive-preferences`, HEAD `95e1c04`, following commits `1ff0b36`, `f9b2e4e`, and `febbceb`. The working tree contains extensive modified and untracked application code, including the profile-action service. Findings therefore describe the **inspected working tree**, not necessarily the committed or deployed application. Evidence: `git status --short`, `git branch --show-current`, and `git log -4`.

I read current implementation alongside README and architecture/planning documents. Those documents contain intended capabilities that current execution paths do not establish. For example, the blueprint describes semantic matching and automatic dinner recalibration; the current recalibration endpoint explicitly reports `NO_AUTOMATIC_RECALIBRATION`. (`README.md:20–33`; `BLUEPRINT.md:19–58,76–94`; `SPECS.md:3–7`; `backend/app/api/recalibrate.py:8–11`.)

**Read-only boundary preserved:** no implementation, documentation, configuration, test, snapshot, or data files were written; no packages installed; no migrations, application startup, database operations, browser sessions, or provider calls performed. Repository tests were **not run**.

The only executed behavioral checks were isolated, in-memory probes of unchanged pure functions extracted through Python AST, without importing the application. These establish parser/filter behavior only.

Several frontend files changed externally during the audit. Relevant UI functions were re-read before consolidation. Backend files in the 199-file fingerprint baseline remained unchanged. This was not an immutable repository snapshot.

### Investigation log

The environment supported three concurrent investigators alongside the lead. Eight distinct streams ran in overlapping waves.

| Stream | Agent | Scope | Completion |
|---|---|---|---|
| A | `audit_a_chat` | Chat, prompts, orchestration, history, fallbacks | Complete |
| B | `audit_b_memory` | Events, durable memory, auditor, contradictions, advice adaptation | Complete |
| C | `audit_c_profile` | Onboarding, personas, canonical profile, consent, confirmation | Complete |
| D | `audit_d_catalog` | Catalog grounding, recommendation parity, cart and checkout | Complete |
| E | `audit_e_nutrition` | Nutrition provenance, graph rules, allergies, scanner/logs | Complete |
| F | `audit_f_frontend` | Consumer, merchant/admin, guest/mobile UI connections | Complete; changed files re-read |
| G | `audit_g_security` | Authentication, isolation, injection, transactions, reliability | Complete |
| H | `audit_h_evidence` | Current tests, missing coverage, demo boundaries | Complete |

### Status legend

- **V — IMPLEMENTED AND VERIFIED:** limited to an explicitly described isolated check.
- **U — CODE PRESENT BUT UNVERIFIED:** implementation exists; runtime behavior untested.
- **P — PARTIAL/DISCONNECTED:** only part of the intended workflow exists.
- **B — BROKEN:** supported by a concrete code contradiction or isolated reproduction.
- **M — MISSING:** no active implementation found in inspected execution paths.
- **? — BLOCKED/UNKNOWN:** required runtime, deployment, or data evidence unavailable.

No application journey receives an end-to-end **V** rating.

# QUESTIONS ANSWERED

## Egg-allergy incident: E01–E10

| ID | Status | Answer and evidence |
|---|---|---|
| **E01** | **P / ?** | For the exact first statement, `parse_change()` returns `None`. `consult_chat` attempts to insert/flush the user message, then commits user and assistant messages after generating the response. The text can enter the latest-20-message context. This branch does **not** write an allergy proposal, canonical health profile, extracted long-term allergy fact, or graph constraint. Actual historical commit success is unknown because no incident records were accessed. (`backend/app/api/chat.py:36–38,61–63,75–88,109–110`; `backend/app/services/profile_actions.py:39–65`.) |
| **E02** | **U / P** | Current code **does** implement structured proposals for supported phrases. The assistant shows old/new values and **Update permanently / Just for today / Keep existing**. There is inline review, not a separate Review action. Authenticated `POST /api/ai/actions/{action_id}/confirm` validates ownership and applies the change through `decide()` directly to ORM records; it does not call the health-profile HTTP endpoint. Permanent allergy updates require confirmation, while pending precautions can already affect recommendations. (`backend/app/api/chat.py:46–54,75–84`; `backend/app/services/profile_actions.py:82–100,132–175`; `frontend/src/components/AiAssistantModal.tsx:370–381`.) |
| **E03** | **B** | The reported promise is unsupported by the structured restriction path for that wording. Conversation text can influence model prose while recommendation eligibility still reads `effective_profile()`. Home recommendations, chat suggestions, lunch/swap and personal graph recommendations share that effective state; raw catalog browsing and checkout do not. (`backend/app/api/chat.py:85–106`; `backend/app/services/profile_actions.py:102–130`; `backend/app/api/preferences.py:38–60`; `backend/app/api/recommend.py:8–17`; `backend/app/db/crud.py:426–497`.) |
| **E04** | **M / B** | No structured “possible allergy/reaction” state handles this uncertain disclosure. The anchored parser expects a narrow first-person allergy assertion; it misses uncertainty and the reported misspelling. Therefore no precaution is created for this wording. Neither this fallthrough nor the recognized-allergy response guarantees appropriate assessment wording. The prompt prohibits diagnosis, but that is not a complete uncertainty workflow. (`backend/app/services/profile_actions.py:39–65`; `backend/app/api/chat.py:75–83,94`.) |
| **E05** | **P** | Isolated probes found no structured update for ordinary negation, third-party statements, hypotheticals, removal language, or “eggs and milk.” This avoids certain false extractions but also misses corrections and multi-allergy statements. It does not establish safe model dialogue. Same-field pending proposals can supersede each other, but historical allergy contradictions have no general resolver. (`backend/app/services/profile_actions.py:39–65,90–99,149–174`.) |
| **E06** | **P / ?** | There is no basis to conclude the suggested fish dish was verified egg-free. `serialize_dish()` always returns `allergenCoverage: "unknown"`. `Nutrition source: TKPI` is taken from a catalog enum, not proof of a complete recipe, allergen review, measured serving, or ingredient-to-dish calculation. One seed script even labels imported FatSecret-derived dishes as TKPI. The particular historical dish record was not inspected. (`backend/app/api/dishes.py:35,50–60`; `backend/app/models/menu_item.py:21–57`; `scripts/seed_expanded_fatsecret_dishes.py:64–84`.) |
| **E07** | **B** | The suffix is explicitly appended in the ordinary chat branch: `Catalog suggestion: {name} - Rp{price}. Nutrition source: {source}`. It appears whenever a candidate exists and advice style is not quiet; there is no intent check. Recommendation retrieval happens before the model response and receives neither the current question nor `dish_context`. Stable candidates/fallback selection can therefore repeat the same item. Recognized proposal branches bypass this suffix, so it is not literally attached to every possible response. (`backend/app/api/chat.py:85–108`; `backend/app/api/preferences.py:38–81`.) |
| **E08** | **U / ?** | Active chat, proposal, memory and profile lookups use authenticated user IDs. Confirmed allergies and temporary actions are designed to persist per account. Current personal graph routes construct a user-specific projection rather than mutating shared persona memory. No active cross-user allergy inheritance path was established, but runtime isolation and historical storage remain unverified. (`backend/app/api/chat.py:30–62`; `backend/app/services/profile_actions.py:73–119,135–156`; `backend/app/api/graph.py:43–60`.) |
| **E09** | **B / P** | Direct profile saves do not supersede pending/today actions or reconcile old allergy notes. A pending/today action can reintroduce a removed canonical allergy into effective state until midnight. Pending actions disappear from normal confirmation retrieval after 15 minutes, but `effective_profile()` checks midnight expiry rather than proposal expiry. Chat has no allergy-removal action. (`backend/app/api/users.py:247–274`; `backend/app/services/profile_actions.py:79–80,112–124,140,155–174`.) |
| **E10** | **?** | **There is no inspected evidence that the incident updated the allergy profile.** The current parser reproduction supports the opposite: neither exact message produces a structured change. Conversation persistence is attempted by code, but actual historical persistence, server version, and profile contents are unknown. (`backend/app/api/chat.py:61–84,109–113`; `backend/app/services/profile_actions.py:39–65`.) |

### Isolated reproduction evidence

These checks executed the extracted current parser, without application imports or storage access:

| Synthetic input | Actual parser result |
|---|---|
| `I think ive developed an alergic reaction to eggs` | No structured change |
| `Did you update my profile informationthat im alergic to eggs` | No structured change |
| `I think I've developed a reaction to eggs` | No structured change |
| `I'm allergic to eggs` | `allergy:eggs`, true |
| `I am allergic to egg` | `allergy:telur`, true |
| `I'm not allergic to eggs` | No structured change |
| `My sister is allergic to eggs` | No structured change |
| `If I were allergic to eggs, what could I eat?` | No structured change |
| `I'm no longer allergic to eggs` | No structured change |
| `I am allergic to eggs and milk` | No structured change |
| `saya alergi telur` | `allergy:telur`, true |

The singular/plural discrepancy comes from the alias map: `egg` maps to `telur`; `eggs` does not. (`backend/app/services/profile_actions.py:12,39–65`.)

A separate isolated `passes_hard_filters()` probe showed:

- Unknown allergen coverage plus a user allergy → rejected.
- Synthetic complete coverage, item allergen `telur`, user allergy `telur` → rejected.
- The same synthetic complete item with user allergy `eggs` → accepted.

The last result proves an alias mismatch in the filter. It does **not** describe a currently serialized live candidate: current serialization always reports unknown coverage, masking that mismatch by rejecting all allergy candidates. (`backend/app/services/recommendation_scorer.py:22–45`; `backend/app/api/dishes.py:59–60`.)

### Root-cause reconciliation

The current code supports this causal chain:

1. The uncertain, misspelled disclosure misses structured extraction.
2. The disclosure enters ordinary conversation processing without a corresponding effective allergy restriction.
3. Model prose has no post-generation check ensuring that an avoidance promise matches persisted constraints.
4. Independent catalog formatting appends a suggestion even to unrelated or sensitive dialogue.
5. The next question also misses the parser and follows the same path.

That explains a **current implementation failure mode consistent with the incident**. It does not prove which deployed revision produced the quoted responses.

The denial of profile-update capability is also inconsistent with the **current** supported proposal flow. However, the language model is not given a callable profile-update tool, and unrecognized requests fall through to free-form generation. The precise reason it generated that historical sentence remains unknown. (`backend/app/api/chat.py:63–106`; `backend/app/services/profile_actions.py:39–65`.)

## 1 — Product intent and seamless AI

| ID | Status | Answer and evidence |
|---|---|---|
| **01** | **P** | Touchpoints exist in onboarding matching, home recommendations, menu consultation, shared chat, scanner and merchant nutrition estimation. Search is local filtering; profile is explicit editing; cart exposes shared chat without cart-specific reasoning; checkout is commerce logic. (`frontend/src/app/onboarding/personas/page.tsx:123–175`; `frontend/src/app/page.tsx:80–155`; `frontend/src/app/menu/[id]/page.tsx:120–145`; `frontend/src/components/AppShell.tsx:56–58`; `frontend/src/app/merchant/page.tsx:216–261`.) |
| **02** | **U / P** | Automatic actions include recommendation loading/refresh and logging detail/cart events. Chat, consultation, scan, estimate and profile confirmation require user actions. No automatic durable taste-learning connection follows ordinary browsing events. (`frontend/src/app/page.tsx:135–142`; `frontend/src/context/AppContext.tsx:214–240`; `backend/app/api/actions.py:19–43`.) |
| **03** | **P** | Browser events refresh account/recommendation state. Behavioral endpoints persist events; they do not invoke an auditor or background planner. Chat retrieval is synchronous. (`frontend/src/components/AccountSessionController.tsx:27–54`; `frontend/src/components/AiAssistantModal.tsx:112–150`; `backend/app/api/actions.py:19–43`; `backend/app/api/chat.py:85–108`.) |
| **04** | **U / P** | Home cards contain real catalog data and Add controls; recommendations link into commerce. Detail advice is behind a disclosure. Assistant replies remain plain text, with no actionable recommendation card. Actual obstruction/usability was not browser-tested. (`frontend/src/app/page.tsx:20–44,178–185`; `frontend/src/app/menu/[id]/page.tsx:209–221`; `frontend/src/components/AiAssistantModal.tsx:355`.) |
| **05** | **P / B** | Users can shop without accepting advice. There is no connected persistent suggestion-dismiss/reason flow. Add controls check availability, not health goals or allergies, so freedom to ignore soft goals currently also permits bypassing allergy recommendation restrictions. (`frontend/src/app/page.tsx:157–185`; `frontend/src/app/menu/[id]/page.tsx:147–152`; `backend/app/db/crud.py:426–497`.) |
| **06** | **P / ?** | Guests can reach browsing/cart/menu/scanner shells; personal chat requires sign-in. Profile/onboarding are protected. Merchant/admin routes have client sign-in/role gates even though middleware allows their shells. Mobile and protected interfaces were not exercised; no screenshots from this audit establish authenticated behavior. (`frontend/src/lib/clerk/proxy-config.ts:3–18`; `frontend/src/components/ingredients/IngredientGuard.tsx:14–18`; `frontend/src/components/AiAssistantModal.tsx:329`; `frontend/src/app/scanner/page.tsx:59–94`.) |
| **07** | **P** | Current UI adds useful simulation and nutrition caveats, but alignment remains incomplete: detail consultation labels deterministic/action responses as model responses, and graph UNKNOWN can appear as a rule conflict. Architecture claims of autonomous learning exceed active code. (`frontend/src/app/menu/[id]/page.tsx:140,182,192–202`; `README.md:20–33`; `backend/app/services/memory_extractor.py:66–80`.) |

## 2 — RAG, retrieval, and tool-using agent

| ID | Status | Answer and evidence |
|---|---|---|
| **08** | **P** | Active retrieval includes SQL catalog/profile/preferences, DB conversation history, and a seven-day dismissal count. A static NetworkX template engine and external nutrition lookup service exist. Embedding code exists but no active application callsite was found; general behavioral and long-term memory retrieval are not assembled into ordinary chat. (`backend/app/api/preferences.py:38–71`; `backend/app/api/chat.py:36–38,88–96`; `backend/app/services/profile_actions.py:125–129`; `backend/app/ai/embeddings.py:14–58`; `backend/app/services/knowledge_graph.py:55–63`.) |
| **09** | **M** | No dynamic tool-selection loop or callable tool schemas are supplied to the chat model. The server parses supported changes and calls a fixed recommendation pipeline before generation. HTTP endpoints exist, but they are not model-callable tools in this path. (`backend/app/api/chat.py:63–106`; `backend/app/ai/planner.py:33–57`.) |
| **10** | **P** | Recommendations query the live PostgreSQL catalog, but do not search based on the current chat request, retrieve selected dish details as a tool, or perform a second search. `dish_context` is stored but omitted from model history/retrieval. (`backend/app/api/preferences.py:38–71`; `backend/app/api/chat.py:21–25,36–38,61–62,85–96`.) |
| **11** | **P** | Structured recommendations come from eligible DB candidates with IDs, merchant data, prices and availability at retrieval time. There is no supported customization-option schema, and the chat suffix does not expose the complete structured object. Checkout does not revalidate that snapshot authoritatively. (`backend/app/api/preferences.py:48–87`; `backend/app/models/menu_item.py:25–57`; `backend/app/api/chat.py:104–113`; `backend/app/db/crud.py:446–495`.) |
| **12** | **U / P** | Current recommendation/planner/swap paths preserve empty candidates; they do not restore excluded items. Ordinary model prose remains unvalidated, so complete prevention of invented textual alternatives is unproven. (`backend/app/ai/planner.py:16–22`; `backend/app/api/preferences.py:63–91`; `backend/app/api/recommend.py:8–17`; `backend/app/api/chat.py:94–106`.) |
| **13** | **P** | The planner chooses within a fixed prompt, not an autonomous strategy loop. Returned item ID—or a unique exact name—must match eligible candidates; the server returns the original DB object. Ordinary conversational claims have no comparable semantic validator. (`backend/app/api/preferences.py:65–81`; `backend/app/ai/planner.py:33–57`; `backend/app/api/chat.py:94–106`.) |
| **14** | **P** | Chat instructions prohibit invented merchant customizations, and current detail UI says preparation changes cannot be requested there. No structured option validation or merchant communication tool exists. Prompt compliance alone cannot prove that generated prose never invents modifications. (`backend/app/api/chat.py:94`; `backend/app/models/menu_item.py:25–57`; `frontend/src/app/menu/[id]/page.tsx:174`.) |
| **15** | **P** | Proposal records carry source, old/new values, status and expiry. Generic memory rows have source, confidence and timestamp, but are not retrieved into ordinary chat. Effective profile and recent messages lose much of that provenance when assembled for the model; no relevance-ranked memory retrieval exists. (`backend/app/services/profile_actions.py:93–130`; `backend/app/models/user_memory.py:12–21`; `backend/app/api/chat.py:88–96`.) |
| **16** | **P** | Messages are length-bounded and history is limited to 20 DB messages. Browser roles are ignored. There is no explicit token budget or rolling summary; planner candidates can include the whole eligible catalog. Instructions identify untrusted data, but free-form output remains susceptible to influence from history/profile/catalog text. (`backend/app/api/chat.py:21–25,36–38,94–106`; `backend/app/api/preferences.py:66–71`; `backend/app/ai/planner.py:37–54`.) |
| **17** | **P** | Home recommendations, chat suggestions, lunch/swap and personal graph recommendation routes share `personalized_recommendation()`. Raw search/detail, ordering and the legacy template graph do not share the same enforcement. The central caller also passes `medical_conditions: []`, leaving medical-condition filters disconnected there. (`backend/app/api/preferences.py:38–60`; `backend/app/api/recommend.py:8–17`; `backend/app/api/graph.py:26–41`; `backend/app/api/dishes.py:66–124`.) |

## 3 — Short-term memory, long-term memory, and audit

| ID | Status | Answer and evidence |
|---|---|---|
| **18** | **P** | Frontend producers log search submission, item clicks, detail views and cart additions. Remove, dismissal and feedback types are accepted by the backend but have no connected producers found. Quantity/remove/clear operations do not log corresponding events. Orders and meals use separate tables. (`frontend/src/components/ShopeeHeader.tsx:93–106`; `frontend/src/app/page.tsx:164–168`; `frontend/src/context/AppContext.tsx:214–240`; `backend/app/api/actions.py:14–43`.) |
| **19** | **U / P** | Behavioral “short-term” context is persistent event storage retrieved by latest count—default 15, maximum 50—not expiring session memory. Quiet-style calculation separately uses seven days. (`backend/app/models/user_action.py:7–21`; `backend/app/api/actions.py:45–66`; `backend/app/db/crud.py:642–649`; `backend/app/services/profile_actions.py:125–129`.) |
| **20** | **M** | No active auditor invocation or promotion threshold was found. `extract_and_store_memories()` only returns deterministic candidates; it neither calls an LLM nor stores them. No dynamic threshold exists in the inspected active path. (`backend/app/services/memory_extractor.py:66–80`; `backend/app/api/chat.py:57–113`; `backend/app/api/actions.py:19–43`.) |
| **21** | **P** | Explicit confirmed preference changes are distinguished by source. There is no active repeated-food-pattern audit. Three dismissals in seven days affect advice style, but that is a fixed heuristic, not calibrated inference. (`backend/app/services/profile_actions.py:93–99,125–129,157–162`.) |
| **22** | **P** | Same-field pending proposals are superseded; confirmation checks stale canonical values; opposite explicit food preferences are replaced. General memory contradictions and historical allergy corrections are not reconciled. (`backend/app/services/profile_actions.py:90–99,139–174`; `backend/app/services/explicit_preferences.py:29–48`.) |
| **23** | **U** | No active order→taste or order→consumption promotion was found. Order/log persistence is separate, and the chat prompt explicitly treats orders/clicks as observations. Generated compliance remains untested. (`backend/app/db/crud.py:426–497,512–559`; `backend/app/api/chat.py:94`.) |
| **24** | **P** | Owned memory list/add/delete APIs exist. Deletion is restricted by source; explicit preferences require their own change path. No connected memory-management UI or complete history/derived-state invalidation was found. (`backend/app/api/users.py:385–452`; `backend/app/services/profile_actions.py:157–174`.) |
| **25** | **U** | Active personal memories/events/history/actions are UID-scoped. A shared-persona dynamic-memory helper remains in the legacy graph engine, but no production caller was found; it is not proof of current cross-user contamination. (`backend/app/api/chat.py:30–62`; `backend/app/api/users.py:13–20,442–452`; `backend/app/services/profile_actions.py:73–74,135–136`; `backend/app/services/knowledge_graph.py:675–723`.) |
| **26** | **P / B** | Applied today-only changes expire at Jakarta midnight. Old observations have no general decay. Pending allergy precautions incorrectly outlive their 15-minute confirmation availability until midnight. (`backend/app/services/profile_actions.py:17–18,79–80,93–98,112–129,140`.) |
| **27** | **P** | The model receives the latest 20 actual DB user/assistant messages in chronological order. The history endpoint returns all messages; the frontend progressively reveals them locally. No rolling summary or server pagination was found. (`backend/app/api/chat.py:36–44,95–96`; `frontend/src/components/AiAssistantModal.tsx:89–110,152–159`.) |
| **28** | **P** | Chat and dish consultation share `/api/ai/chat` and persistent history. Detail consultation nevertheless displays only its local result, ignores pending proposal metadata, and supplies dish context that the model window does not use. (`frontend/src/app/menu/[id]/page.tsx:120–145`; `frontend/src/components/AiAssistantModal.tsx:117–134`; `backend/app/api/chat.py:36–38,61–62,109–113`.) |
| **29** | **M / P** | There is no active LLM memory-extraction workflow whose failure recovery can be credited. Ordinary chat separately uses an eight-second timeout, no retries, and a labeled deterministic fallback. (`backend/app/services/memory_extractor.py:66–80`; `backend/app/api/chat.py:90–103`.) |

## 4 — Adaptive personas, profile, and confirmation

| ID | Status | Answer and evidence |
|---|---|---|
| **30** | **U / P** | Onboarding collects health/profile information, goals, concerns, dietary disclosure, activity, age, budget, priorities and district. PostgreSQL health profile, persona assignments and onboarding-memory records are separate representations; Clerk supplies identity/role and React holds fetched account state. No browser-persisted authoritative health copy was found in the inspected bootstrap path. (`backend/app/api/personas.py:20–41,153–214`; `backend/app/services/onboarding_details.py:7–44`; `frontend/src/services/onboarding-contract.ts:3–77`; `frontend/src/services/account-bootstrap.ts:10–34`.) |
| **31** | **M** | Main/side personas change through explicit assignment. No production path recomputes them from later behavior or memory. (`backend/app/api/personas.py:153–199`; `frontend/src/app/onboarding/personas/page.tsx:147–175`.) |
| **32** | **P** | Explicit health information is separated from persona conditions during assignment. However, persona cooking tags/habits become memory statements with confidence values `.90`/`.85`; those are defaults, not confirmed tastes or measured probabilities. (`backend/app/api/personas.py:176–178,204–274`; `backend/app/models/user_memory.py:12–21`.) |
| **33** | **P** | Supported structured requests include narrow budget phrases, enumerated food likes/dislikes, less fried food, first-person allergy addition and ISO DOB. Goal changes and explicit communication-style updates are unsupported. (`backend/app/services/profile_actions.py:25–65`.) |
| **34** | **U / P** | Proposals preserve old/new values and show permanent/today/reject choices where allowed. DOB cannot be temporary; “no rice today” cannot be permanent. No separate review screen or general temporal-language interpreter exists. (`backend/app/services/profile_actions.py:73–100,132–176`; `frontend/src/components/AiAssistantModal.tsx:370–381`.) |
| **35** | **P** | Confirmation validates ownership, locks records, checks expiry/status/staleness and applies changes. Assistant refresh events reach account/home state, and personal graph reads effective state. Detail consultation ignores those response signals, and runtime parity is unverified. (`backend/app/services/profile_actions.py:132–175`; `backend/app/api/chat.py:46–54`; `frontend/src/components/AiAssistantModal.tsx:112–150`; `frontend/src/app/menu/[id]/page.tsx:127–140`.) |
| **36** | **P / B** | Direct profile editing exists, with a client-side stale-signature check. The server does not invalidate pending/today actions or allergy memories; it accepts a default-filled profile payload without atomic version checking. Partial callers can reset omitted fields. (`frontend/src/app/profile/profile-form.tsx:84–101`; `backend/app/api/users.py:35–46,247–274`; `backend/app/services/profile_actions.py:112–124,166–174`.) |
| **37** | **P** | When DOB exists, age is calculated deterministically using the Jakarta date. Otherwise numeric age remains stored. DOB confirmation updates age but does not recompute stored metabolic targets, and existing DOB can override later numeric-age edits. (`backend/app/services/profile_actions.py:20–33,110–111,163–165`; `backend/app/db/crud.py:155–182`; `backend/app/api/users.py:90–102`.) |
| **38** | **B / P** | Sensitive proposals/application and manual notes check consent, but account sync defaults consent to true and overwrites existing values while the frontend omits the field. Ordinary refresh can re-enable withdrawn consent. Direct profile/onboarding writes lack equivalent gating; no withdrawal UI was found. (`backend/app/api/users.py:25–30,105–140,247–274,414–438`; `backend/app/db/crud.py:44–75`; `frontend/src/services/account-session.ts:25–39`; `backend/app/services/profile_actions.py:82–87,143–146`.) |
| **39** | **M** | There is no specialized allergy-removal confirmation flow. Chat only adds allergies; profile checkbox removal uses ordinary Save. (`backend/app/services/profile_actions.py:57–61,153–156`; `frontend/src/app/profile/profile-form.tsx:221–230,258–261`.) |

## 5 — Learning what to recommend and how to advise

| ID | Status | Answer and evidence |
|---|---|---|
| **40** | **P** | Explicit food preferences persist with provenance, but no active mechanism learns tastes from repeated behavior. Confidence `1` on confirmed preference records is an application convention, not calibrated prediction confidence. (`backend/app/services/explicit_preferences.py:7–54`; `backend/app/services/profile_actions.py:157–162`.) |
| **41** | **P / disconnected** | Three recent dismissals produce provisional quiet mode. No frontend dismissal producer was found, and tone/timing/frequency learning is absent. (`backend/app/services/profile_actions.py:125–129`; `backend/app/api/chat.py:104–108`; `backend/app/api/actions.py:14–43`.) |
| **42** | **M end to end** | Generic feedback events can be accepted, but no connected producer/consumer distinguishes food dislike from price, spice, portion or repetition. Proposal rejection is a separate action. (`backend/app/api/actions.py:14–43`; `backend/app/services/profile_actions.py:174`; `frontend/src/context/AppContext.tsx:152–169,214–240`.) |
| **43** | **U / P** | Confirmed explicit changes feed the effective state used by home/chat recommendations. Repeated feedback does not update tastes. The planner receives exclusions and budget, so an LLM choice may also supersede deterministic ranking without receiving every scoring factor. (`backend/app/services/profile_actions.py:102–130`; `backend/app/api/preferences.py:41–81`; `frontend/src/components/AiAssistantModal.tsx:112–150`.) |
| **44** | **U / P** | Dismissal adaptation changes advice style while retaining the canonical goal. No active behavioral goal overwrite was found. More sophisticated strategy adaptation is absent. (`backend/app/services/profile_actions.py:104–109,125–129`; `backend/app/api/preferences.py:56–62`.) |
| **45** | **M** | No active scheduled/event-driven proactive nudge system was found. Event logging only persists observations; chat suggestions are synchronous. There is no connected nudge frequency/dismissal policy. (`backend/app/api/actions.py:19–43`; `backend/app/api/chat.py:85–108`.) |
| **46** | **U** | Current order/log separation and prompt instructions avoid explicitly converting orders into intake. No active inference that an unlogged meal was skipped was found. Model compliance was not tested. (`backend/app/db/crud.py:426–497,512–559`; `backend/app/api/chat.py:94`.) |
| **47** | **U / P** | Server candidates require available dishes, open merchants/outlets and budget eligibility; suggestions remain optional. This is a retrieval-time check, not reserved stock or checkout revalidation. Allergy metadata currently prevents positive recommendations for allergic users. (`backend/app/api/preferences.py:48–54`; `backend/app/api/dishes.py:59–60`; `backend/app/db/crud.py:446–495`.) |
| **48** | **P** | Responses expose effective state, candidate IDs and score breakdowns; logs record counts/selection/source/latency. Proposal records preserve old/new values. No complete persisted decision trace links changed recommendations to specific behavioral evidence over time. (`backend/app/api/preferences.py:82–91`; `backend/app/services/recommendation_scorer.py:290–303`; `backend/app/services/profile_actions.py:93–99`.) |

## 6 — Nutrition data, graph, and medical language

| ID | Status | Answer and evidence |
|---|---|---|
| **49** | **P / ?** | Runtime paths expose stored merchant/catalog nutrients, TKPI/ESTIMATE labels, FatSecret lookup with local fallback, LLM/keyword merchant estimation, and photo estimates. Provider configuration and successful production calls were not verified. Asking the model to use TKPI is not source retrieval. (`backend/app/models/menu_item.py:21–57`; `backend/app/api/nutrition.py:19–50`; `backend/app/services/fatsecret_service.py:409–550`; `backend/app/api/merchant.py:190–284`.) |
| **50** | **? / P** | No live database enrichment count was obtained. Recipe links do not calculate complete dish nutrition from reference ingredients. The existing seed import assigns a TKPI label to FatSecret-derived data, so a label cannot establish enrichment provenance. (`backend/app/models/ingredient.py:13–58`; `backend/app/services/ingredients.py:100–130`; `scripts/seed_expanded_fatsecret_dishes.py:64–84`.) |
| **51** | **P** | Live menu profiles store calories, protein, carbs, fat and sodium. FatSecret detail parsing also exposes fiber, sugar, saturated fat, cholesterol, calcium and iron, but those fields are not connected to the live menu model/ranking pipeline. (`backend/app/models/menu_item.py:40–44`; `backend/app/services/fatsecret_service.py:480–550`; `backend/app/services/recommendation_scorer.py:109–154,264–303`.) |
| **52** | **P / B** | Per-value provenance, serving basis, completeness and uncertainty are not consistently stored. Merchant defaults and reference parsing can supply assumed values; some missing reference nutrients become zero. Photo confidence is model-produced, not calibrated measurement uncertainty. (`backend/app/models/menu_item.py:25–57`; `backend/app/api/merchant.py:136–146,190–284`; `backend/app/services/fatsecret_service.py:503–517`; `backend/app/ai/vision.py:44–49`.) |
| **53** | **P / disconnected** | Merchant recipe editing supports ingredient IDs, quantities and version checks. Ingredient records lack full nutrient/allergen verification data, and the legacy graph loads static files without a recipe-change refresh connection. (`backend/app/services/ingredients.py:100–130`; `backend/app/models/ingredient.py:13–58`; `backend/app/services/knowledge_graph.py:55–63`.) |
| **54** | **P** | The current loader supports nested `nutrient_ceilings_per_meal` **and now maps** flat sodium/fat fields into it. An older claim that it ignores all flat fields is outdated. Other rule dimensions remain unsupported by the evaluator, which checks numeric fat and sodium ceilings. (`backend/app/services/knowledge_graph.py:72–102,489–505`; `backend/app/data/ontology/clinical_rules.json:64,139–140,173–174`.) |
| **55** | **P** | Unknown persona/dish identifiers return UNKNOWN; current resolution does not silently choose a fuzzy substitute. Personal API safety remains UNKNOWN. However, the legacy engine substitutes zero for missing nutrients, defaults unknown cooking method to clear soup, and may call a known dish SAFE when no contradiction is found. (`backend/app/services/knowledge_graph.py:235–266,326–343,377–399,519–527`; `backend/app/api/graph.py:33–41`.) |
| **56** | **P / ?** | Rule files contain guideline/source text, but source strings and graph logic do not establish individualized clinical validation. Personal graph responses explicitly return `clinical_verified: false`; legacy SAFE/clinical wording remains overstrong. No external validation study was verified. (`backend/app/services/knowledge_graph.py:79–102,489–527`; `backend/app/api/graph.py:21–60`.) |
| **57** | **P / B** | Allergies are hard recommendation restrictions. Goals influence ranking, but budget and explicit excluded foods are also hard filters, not merely soft ranking preferences. Allergy enforcement does not extend through ordering. (`backend/app/services/recommendation_scorer.py:22–45`; `backend/app/api/preferences.py:52–62`; `backend/app/db/crud.py:426–497`.) |
| **58** | **P / B** | Scanner distinguishes unavailable/demo/AI results and requires explicit review before logging. But the required model output omits protein/carbs/fat/sodium while the save predicate requires them, so a prompt-compliant response cannot be logged. Saving also loses photo provenance because the route hardcodes `manual_note`. (`backend/app/ai/prompts.py:1–18`; `frontend/src/app/scanner/analysis.ts:16–38`; `frontend/src/app/scanner/page.tsx:80–94,126–140`; `backend/app/api/users.py:305–322`.) |
| **59** | **P** | Meal logs and purchases are separate. Daily intake uses Jakarta midnight converted to UTC, but lacks an upper boundary, so future-dated rows would count. Optional order linkage is accepted without checking that the order belongs to the caller. (`backend/app/db/crud.py:426–497,512–568`; `backend/app/api/users.py:305–322`.) |
| **60** | **M, explicitly disabled** | Current recalibration does not compute new targets or remaining intake. It returns `NO_AUTOMATIC_RECALIBRATION` plus an ordinary personalized recommendation. Earlier fixed-output descriptions should not be treated as current behavior. (`backend/app/api/recalibrate.py:8–11`.) |

## 7 — Commerce and cart-grounded actions

| ID | Status | Answer and evidence |
|---|---|---|
| **61** | **M for agent action** | The assistant can return suggestions but has no cart tool. Users add items through ordinary UI. No assistant cart-action confirmation contract exists. (`backend/app/api/chat.py:56–113`; `frontend/src/components/AiAssistantModal.tsx:117–150,355`; `frontend/src/app/page.tsx:157–162`.) |
| **62** | **M for agent action / U for simulation** | Chat cannot initiate checkout/payment or contact merchants. Manual checkout persists simulated orders/rewards. No real payment, dispatch or merchant messaging call exists in that path; current UI explicitly labels the simulation. (`backend/app/api/users.py:348–381`; `backend/app/db/crud.py:426–497,575–597`; `frontend/src/app/cart/page.tsx:72–79,120–129`.) |
| **63** | **P / B** | Recommendation IDs/prices originate from DB candidates, but order creation trusts submitted totals, prices and quantities. Invalid merchant/item IDs can be replaced by fallback records. Availability and item-to-merchant relationship are not revalidated there. (`backend/app/api/preferences.py:48–87`; `backend/app/api/users.py:63–69`; `backend/app/db/crud.py:446–495`.) |
| **64** | **B** | Users can continue shopping despite soft goals, but they can also bypass AI allergy restrictions through raw catalog/cart/order paths. No consistent server order restriction check exists. (`frontend/src/app/menu/[id]/page.tsx:147–152`; `backend/app/db/crud.py:426–497`.) |
| **65** | **P** | Current cart labels demo fees and simulated checkout, explicitly denying real payment/dispatch/bank transfer. Internal order/reward records still use confirmed/payment-like metadata; those are simulation records, not real integration evidence. Uniform clarity across every reward/voucher state was not runtime-verified. (`frontend/src/app/cart/page.tsx:72–79,120–129`; `backend/app/db/crud.py:432–475,575–597`.) |
| **66** | **B** | No order idempotency key exists. Header, items and rewards commit separately. Repeated submissions create new orders; per-order reward uniqueness does not prevent rewards on duplicate orders. The API’s client-controlled healthy-pick flag defaults true. No current agent checkout tool amplifies this, but a future one would inherit it. (`backend/app/api/users.py:63–69,348–381`; `backend/app/db/crud.py:459–495,575–596`; `backend/app/models/reward_ledger.py:19`.) |

## 8 — UI, wording, and experience

| ID | Status | Answer and evidence |
|---|---|---|
| **67** | **U** | Current home source centers commerce cards, prices, merchant names, filters and cart actions. AI is a supporting suggestion/disclosure. Visual quality and task completion remain untested. (`frontend/src/app/page.tsx:20–44,173–208`.) |
| **68** | **P** | Home/detail integrate real food data and Add controls. The assistant ignores the returned recommendation object as an actionable card and renders text instead. (`frontend/src/app/page.tsx:178–185`; `frontend/src/app/menu/[id]/page.tsx:159–175`; `frontend/src/components/AiAssistantModal.tsx:117–134,355`.) |
| **69** | **B** | Ordinary chat appends suggestion text without an intent/sensitivity gate. The exact allergy statement is unrecognized and therefore reaches that path. (`backend/app/api/chat.py:85–108`; `backend/app/services/profile_actions.py:39–65`.) |
| **70** | **P** | Nutrition/allergen caveats are improved, but free-form remembering/safety promises remain unvalidated. Menu consultation mislabels deterministic/action responses, and graph UNKNOWN becomes a conflict in the UI. No clinical verification is established. (`backend/app/api/chat.py:94–106`; `frontend/src/app/menu/[id]/page.tsx:140,182,192–202`.) |
| **71** | **P** | The assistant supports inline old/new review and three choices. Detail consultation does not render these proposals. Raw internal fields/boolean values and generic expiry text limit clarity. (`frontend/src/components/AiAssistantModal.tsx:370–381`; `frontend/src/app/menu/[id]/page.tsx:127–140`.) |
| **72** | **U / ?** | Source includes focus trapping, Escape, scroll lock/restoration, responsive drawer sizing, safe-area spacing and an inline cart trigger. Mobile “Ask NutriSea” opens the modal. No device, keyboard or overlap testing was performed. (`frontend/src/components/AiAssistantModal.tsx:54–77,196–234`; `frontend/src/components/BottomNav.tsx:58–67`; `frontend/src/components/AppShell.tsx:56–58`; `frontend/src/app/globals.css:3139–3163`.) |
| **73** | **P** | Consumer flows are primarily English with Indonesian dish names/tokens and mixed backend messages. No application-wide localization selector was found. The chat language instruction does not localize the UI. (`backend/app/api/chat.py:94`; `frontend/src/app/page.tsx:173–208`; `frontend/src/app/scanner/page.tsx:119–140`.) |
| **74** | **P** | Scanner and cart expose useful failure/demo states. Home discards recommendation source, menu mislabels non-model responses, graph failures are silently reduced to unavailable, and merchant estimation can return indistinguishable fallback values. (`frontend/src/app/page.tsx:96–106`; `frontend/src/app/menu/[id]/page.tsx:103–109,140`; `frontend/src/app/scanner/page.tsx:119–140`; `backend/app/api/merchant.py:190–284`.) |

## 9 — Security, tests, and demo readiness

| ID | Status | Answer and evidence |
|---|---|---|
| **75** | **U / P** | Personal chat/history/events/memory/profile/recommendation/graph routes have authenticated account scoping. JWT verification checks signature, issuer, temporal/session claims and authorized party. Scanner is public. Secondary references remain weak: meal logs accept arbitrary order IDs, and orders check recommendation existence rather than ownership. This establishes reference-integrity gaps, not demonstrated data disclosure. (`backend/app/core/ingredient_auth.py:75–116`; `backend/app/api/users.py:13–20,305–322`; `backend/app/db/crud.py:452–457,536–540`; `backend/app/api/scan.py:9–16`.) |
| **76** | **P** | Browser-supplied history/roles cannot become model roles. Planner selections are constrained to eligible candidates. Profile JSON still appears within a system message, and free-form history/catalog/merchant text can influence unvalidated language. No prompt-injection exploit was executed. (`backend/app/api/chat.py:21–25,36–38,94–106`; `backend/app/api/preferences.py:72–81`; `backend/app/api/merchant.py:190–228`.) |
| **77** | **U / P** | Tests exist for confirmation, some isolation, recognized shrimp allergy, catalog membership, empty candidates, history and the dismissal heuristic. Exact uncertain egg wording, aliases, consent reset, direct-edit/temporary precedence, browser feedback learning and server checkout integrity are uncovered. Detailed inventory below. (`backend/tests/test_agentic_profile.py:50–186`; `backend/tests/test_explicit_preferences.py:54–114`; `frontend/src/app/cart/checkout.test.ts:6–25`.) |
| **78** | **Not run** | **No repository tests ran during this audit.** Only the isolated parser/filter probes described above executed. Historical pass counts were not reused. Database suites create tables and commit records; even the isolated runner writes temporary files/schema/data. (`backend/tests/test_agentic_profile.py:20–36`; `scripts/run_backend_tests.py:12–35`.) |
| **79** | **U / ?** | Code supports a proposed synthetic demo of explicit budget proposal → confirmation → changed catalog candidates, recognized allergy → unknown-coverage refusal, persistent history, and labeled fallback. None was demonstrated here. Authenticated browser startup itself POSTs bootstrap/sync, so it is not a guaranteed nonmutating audit journey. (`backend/tests/test_agentic_profile.py:50–92,103–120,138–149`; `frontend/src/services/account-session.ts:25–39`.) |
| **80** | **B / P** | Top five blockers are: uncertain-allergy handling and normalization; absent complete allergen coverage with commerce bypass; consent/temporary-state lifecycle; order integrity/idempotency; scanner/log contract. Ranked impact and proposed acceptance criteria appear below. (`backend/app/services/profile_actions.py:12,39–65,112–124`; `backend/app/api/dishes.py:59–60`; `backend/app/db/crud.py:44–75,446–495`; `backend/app/ai/prompts.py:1–18`; `frontend/src/app/scanner/analysis.ts:34–38`.) |

# EVIDENCE: feature status, system connections, and interfaces

## Feature status matrix

| Feature | Current status | Evidence paths/lines | User-facing behavior | Missing connection | Risk / priority |
|---|---|---|---|---|---|
| Persistent chat | U | `backend/app/api/chat.py:36–44,109–113` | Shared stored conversation; recent 20 used | Runtime proof, pagination, summary | P1 |
| Structured profile proposals | P | `backend/app/services/profile_actions.py:39–100,132–176` | Supported phrases produce choices | Broad intent/uncertainty handling; detail UI parity | P0 |
| Allergy protection | B/P | `backend/app/api/dishes.py:59–60`; `backend/app/services/recommendation_scorer.py:22–45`; `backend/app/db/crud.py:426–497` | Recognized allergy yields no AI candidates | Verified coverage, aliases, ordering enforcement | P0 |
| Live catalog grounding | U/P | `backend/app/api/preferences.py:48–87` | Selected object comes from eligible DB candidates | Query-aware retrieval; authoritative checkout | P0/P1 |
| Tool-using agent | M | `backend/app/api/chat.py:63–106`; `backend/app/ai/planner.py:33–57` | Fixed server sequence | Tool schemas, iterative retrieval, bounded strategy | P1 |
| Behavioral taste learning | M active workflow | `backend/app/api/actions.py:19–43`; `backend/app/services/memory_extractor.py:66–80` | Events stored; explicit preferences can change | Auditor, promotion and contradiction lifecycle | P1 |
| Advice-style learning | P/disconnected | `backend/app/services/profile_actions.py:125–129` | Quiet after three API-posted dismissals | Actual dismissal UX and reason semantics | P1 |
| Adaptive personas | M automatic evolution | `backend/app/api/personas.py:153–274` | Explicit assignment; template-derived notes | Controlled evidence-based evolution | P2 |
| Personal graph | P | `backend/app/api/graph.py:21–60` | User-specific restrictions/eligible-item projection | Rich evidence retrieval; verified recipe graph | P1 |
| Scanner → food log | B/P | `backend/app/ai/prompts.py:1–18`; `frontend/src/app/scanner/analysis.ts:34–38`; `backend/app/api/users.py:305–322` | Review UI exists; ordinary output lacks log fields | Contract alignment and preserved provenance | P1 |
| Intake recalibration | M | `backend/app/api/recalibrate.py:8–11` | Explicitly reports no automatic recalibration | Confirmed-intake calculation | P2 |
| Consent lifecycle | B | `backend/app/api/users.py:25–30`; `backend/app/db/crud.py:44–75` | Sync can silently re-enable consent | Durable withdrawal and uniform checks | P0 |
| Simulated checkout | B/P | `backend/app/db/crud.py:446–495,575–596` | User can save simulated orders | Server validation, atomicity, idempotency | P0 |

## System data-flow map

“Implemented” below means a connection exists in inspected code, not that it passed an end-to-end test.

| Edge | State | Actual connection and evidence |
|---|---|---|
| User interaction → event log | **PARTIAL** | Search/click/detail/add producers exist; other declared events lack UI producers. `frontend/src/context/AppContext.tsx:152–169,214–240`; `backend/app/api/actions.py:14–43`. |
| Event log → short-term retrieval | **IMPLEMENTED** | Latest-count event retrieval exists. `backend/app/db/crud.py:642–649`. |
| Short-term context → memory audit | **MISSING** | No active auditor call; extractor only returns candidates. `backend/app/services/memory_extractor.py:66–80`. |
| Memory audit → long-term facts | **MISSING** | No active promotion/persistence workflow. Same evidence. |
| Explicit confirmation → durable preference/profile | **IMPLEMENTED, narrow** | Confirmed supported changes update canonical records. `backend/app/services/profile_actions.py:153–175`. |
| Generic long-term memory → chat RAG | **MISSING** | Ordinary chat assembles effective profile and recent messages, not generic memory rows. `backend/app/api/chat.py:88–96`. |
| Explicit preferences/profile → effective context | **IMPLEMENTED** | Canonical state plus temporary actions and dismissal heuristic. `backend/app/services/profile_actions.py:102–130`. |
| Conversation → recent model context | **IMPLEMENTED** | Latest 20 DB messages. `backend/app/api/chat.py:36–38,95–96`. |
| Effective context → personal graph | **IMPLEMENTED, limited** | User restriction/eligibility projection. `backend/app/api/graph.py:43–60`. |
| Legacy clinical graph → live catalog eligibility | **PARTIAL/DISCONNECTED** | Personal routes delegate to catalog filtering rather than legacy clinical traversal; central medical conditions are empty. `backend/app/api/graph.py:26–41`; `backend/app/api/preferences.py:44–60`. |
| Effective context → catalog filter → recommendation | **IMPLEMENTED** | Available/open/budget/preference filters, ranking, validated planner selection. `backend/app/api/preferences.py:48–87`. |
| Recommendation → feedback → learned change | **PARTIAL** | Dismissal heuristic exists without a connected feedback UI. `backend/app/services/profile_actions.py:125–129`. |
| Structured chat request → user confirmation | **IMPLEMENTED, narrow** | Regex proposal plus modal controls. `backend/app/api/chat.py:63–84`; `frontend/src/components/AiAssistantModal.tsx:370–381`. |
| Confirmation → canonical update → next recommendation | **PARTIAL** | Server update and frontend refresh exist; stale direct-edit/temporary interactions remain. `backend/app/services/profile_actions.py:132–175`; `frontend/src/components/AiAssistantModal.tsx:112–150`. |
| Confirmed intake → recalculated suggestions | **MISSING** | Explicitly disabled. `backend/app/api/recalibrate.py:8–11`. |
| Recommendation restrictions → cart/order enforcement | **MISSING** | Order persistence lacks the eligibility check. `backend/app/db/crud.py:426–497`. |

## Interface audit

All runtime states below are **untested in this audit**.

| Interface | Current implementation | Principal gap |
|---|---|---|
| **Onboarding** | Protected profile/persona matching and explicit save; sample templates distinguished. `frontend/src/app/onboarding/personas/page.tsx:123–175,194–208,242–257`. | No ongoing persona evolution; consent/default-memory issues remain. |
| **Home/search** | Live catalog, local filters and authenticated recommendations. `frontend/src/app/page.tsx:80–162,178–208`. | First 100 catalog rows limit frontend search/card mapping; no connected rejection reasons; source omitted. |
| **Menu detail** | Live dish, nutrition caveats, Add and consultation. `frontend/src/app/menu/[id]/page.tsx:77–145,159–221`. | Graph request omits bearer token; proposals ignored; UNKNOWN/source labels incorrect. |
| **Cart/checkout** | Guest cart; sign-in/onboarding needed to submit; success waits for returned order ID; simulation labeled. `frontend/src/app/cart/page.tsx:34–79,102–129`. | No allergy gate/cart-aware assistant; backend price/transaction defects. |
| **Profile** | Direct form editing, allergy checkboxes, pre-save comparison and refresh. `frontend/src/app/profile/profile-form.tsx:84–101,221–230`. | No allergy-specific removal review or memory/temporary-state reconciliation. |
| **Assistant** | Authenticated history, older-message expansion, structured proposal choices, mobile entry point. `frontend/src/components/AiAssistantModal.tsx:54–77,89–159,370–382`; `frontend/src/components/BottomNav.tsx:58–67`. | Plain text suggestions; narrow parser; no cart tools or active auditor. |
| **Scanner** | Guest analysis; authenticated explicit reviewed save; demo samples blocked from logging. `frontend/src/app/scanner/page.tsx:59–94,119–140`. | Model/log contract mismatch, public provider-cost exposure, lost photo provenance. |
| **Food log** | Backend logging exists; scanner is the only frontend meal-log caller found. `backend/app/api/users.py:305–322`; `frontend/src/app/scanner/page.tsx:80–94`. | No separate history/review/delete interface found; no intake-driven recalibration. |
| **Merchant nutrition** | Role-gated shell; estimate fills editable fields; separate save; demo draft remains unsaved. `frontend/src/app/merchant/page.tsx:63–65,216–313,808–815`. | Estimates/defaults lack complete source distinction; no ingredient-to-dish nutrient calculation. |
| **Admin/tools** | Role-gated overview, merchant review and ingredient management; several demo/configuration caveats. `frontend/src/app/admin/page.tsx:81–83,105–133,635,722,803–807`; `frontend/src/components/ingredients/IngredientManagement.tsx:47–71`. | No memory/proposal decision-audit console; authenticated operation untested. |

Merchant/admin URLs are **public middleware routes with client sign-in/role gates**, not unrestricted operational interfaces. (`frontend/src/lib/clerk/proxy-config.ts:3–18`; `frontend/src/components/ingredients/IngredientGuard.tsx:14–18`.)

# GAPS AND RISKS

## Current tests: inspected versus executed

**Repository test execution: not run.** No historical audit pass counts are included.

| Area | Existing coverage inspected | Important missing evidence |
|---|---|---|
| Confirmation and expiry | `backend/tests/test_agentic_profile.py:50–73,121–136` | Browser controls/refresh, direct edits versus pending actions, expired precaution behavior |
| Allergy handling | Recognized shrimp assertion at `backend/tests/test_agentic_profile.py:83–92` | Exact egg incident, uncertainty, aliases, multiple allergies, removal, positive verified-safe candidates |
| Memory extraction | `backend/tests/test_learn_as_you_go.py:6–25` | Active auditor, promotion, general contradictions, provenance-aware retrieval |
| Cross-user isolation | `backend/tests/test_agentic_profile.py:74–82`; `backend/tests/test_account_onboarding.py:106–121` | Browser switching, secondary order/reference ownership, deployed Clerk configuration |
| Catalog grounding | `backend/tests/test_explicit_preferences.py:54–65,76–105` | Checkout repricing, changing stock, recipe completeness |
| Advice adaptation | `backend/tests/test_agentic_profile.py:115–120` | Actual UI dismissal→event→changed advice |
| History/context | `backend/tests/test_agentic_profile.py:103–114,170–186` | Live provider behavior, summaries, token budgets |
| Consent | `backend/tests/test_agentic_profile.py:129–131` | Withdrawal followed by sync; direct-profile/onboarding consistency |
| Scanner | `backend/tests/test_vision_provenance.py:12–42`; `frontend/src/app/scanner/analysis.test.ts:5–27` | Actual prompt output→review→saved log contract |
| Checkout | `frontend/src/app/cart/checkout.test.ts:6–25` | Server integrity, atomicity, idempotency and duplicate-order rewards |

Two important test qualifications:

1. **Isolation exists, but was not used.** Direct database suites use global `SessionLocal`, create tables and commit fixtures. The repository also provides `scripts/run_backend_tests.py:12–35`, which creates isolated temporary SQLite storage and clears provider credentials. That runner still writes files/schema/data, so executing it would have violated this audit’s restriction. (`backend/tests/test_agentic_profile.py:20–36`; `backend/tests/test_explicit_preferences.py:16–38`.)

2. **A stale fixture is visible statically.** `test_account_profile_not_reference_persona_controls_constraints` constructs a health-profile stub with only allergies/budget, while current `effective_profile()` also dereferences `learned_palate`, `goal.value` and age. This predicts a fixture failure; it is **not a measured test failure**. (`backend/tests/test_explicit_preferences.py:107–114`; `backend/app/services/profile_actions.py:107–109`.)

No automated Playwright browser-test suite was found in the inspected inventory. Existing screenshot artifacts do not establish current authenticated end-to-end coverage.

## Additional reliability/security gaps

- **Public scanner cost boundary:** `/api/scan` accepts unbounded optional base64 and can invoke the provider without authentication. No application rate limiter was found; external infrastructure limits remain unknown. (`backend/app/api/scan.py:9–16`; `backend/app/ai/vision.py:19–43`; `backend/app/main.py:23–50`.)
- **Uneven provider controls:** chat/planner use explicit eight-second timeouts and zero retries; scanner/merchant estimation lack equivalent local overrides. (`backend/app/api/chat.py:95`; `backend/app/ai/planner.py:43–57`; `backend/app/ai/vision.py:24–43`; `backend/app/api/merchant.py:214–225`; `backend/app/ai/client.py:15–33`.)
- **Incomplete ownership of linked records:** a user-owned meal log can reference an unchecked order ID; an order can reference another account’s existing recommendation. These are integrity gaps, not proven disclosure. (`backend/app/db/crud.py:452–457,536–540`.)
- **No measured latency or deployment assurance:** model availability, deployed schema, live catalog completeness and historical incident persistence remain unknown because no runtime/provider/database checks were performed.

## Top five demo blockers

| Rank | Blocker | User impact | Implementation risk |
|---|---|---|---|
| **1** | Uncertain allergy statements miss structured handling; aliases differ | Unsupported avoidance promises and inconsistent restrictions | **High:** interpretation, uncertainty and shared normalization |
| **2** | All allergen coverage is unknown, while ordering bypasses recommendation restrictions | No credible positive allergy-safe recommendation demo; unsafe cross-surface expectations | **High:** provenance/data model plus commerce enforcement |
| **3** | Consent resets and stale temporary/profile state | Loss of user control; removed restrictions can reappear | **Medium:** lifecycle and precedence must be explicit |
| **4** | Client-trusted, non-atomic, non-idempotent orders | Wrong totals/items, duplicate simulated orders/rewards | **Medium–high:** server transaction boundary |
| **5** | Scanner output cannot satisfy normal logging requirements | Demo reaches analysis but cannot complete truthful logging | **Medium:** product contract and provenance |

Evidence: `backend/app/services/profile_actions.py:12,39–65,112–124`; `backend/app/api/dishes.py:59–60`; `backend/app/db/crud.py:44–75,446–495`; `backend/app/ai/prompts.py:1–18`; `frontend/src/app/scanner/analysis.ts:34–38`.

# RECOMMENDED NEXT ACTIONS — PROPOSALS ONLY

## P0 — Establish trustworthy constraints and state

1. **Define uncertain-allergy handling and normalize allergens centrally.**
   Acceptance: the exact reported disclosure produces an explicitly uncertain precaution/proposal; it does not diagnose or claim a permanent update. `egg`, `eggs`, and `telur` behave consistently. Negation, third parties, hypotheticals, multiple allergies and corrections have explicit outcomes.

2. **Define one restriction policy across recommendation and commerce.**
   Acceptance: unknown recipe coverage remains unknown; positive allergy-compatible recommendations require adequate evidence; browse/cart/order behavior follows the agreed hard-restriction policy. No fallback restores excluded candidates.

3. **Repair consent and profile-action lifecycle.**
   Acceptance: withdrawal survives refresh; all sensitive writes honor it; expired/rejected/superseded actions have defined effects; direct profile corrections cannot silently be reintroduced by older actions. Allergy removal receives its agreed review level.

4. **Make simulated checkout authoritative and repeat-safe.**
   Acceptance: server validates item/merchant relationships, current availability/prices and restrictions; invalid identifiers are rejected; one transaction covers the order; repeated submission returns one order/reward result.

## P1 — Complete the smallest coherent AI experience

5. **Unify assistant and detail consultation.**
   Acceptance: both render proposals, refresh state, preserve usable dish context, label response sources accurately, and authenticate graph calls. Sensitive/non-shopping replies receive no automatic catalog suffix.

6. **Align scanner analysis, review and logging.**
   Acceptance: a prompt-compliant response reaches a truthful review state and the agreed logging policy without inventing missing nutrients. Saved records retain photo/model provenance. Guest usage, size limits and provider timeouts are explicit.

7. **Add feedback before claiming behavioral adaptation.**
   Acceptance: a real dismissal/reason control creates an owned event; subsequent advice changes for the documented reason while preserving confirmed goals. Learning claims identify whether they reflect explicit facts, heuristics or inference.

8. **Run isolated verification only under separately authorized scope.**
   Acceptance: review and use the disposable runner; add the uncovered incident/lifecycle/checkout scenarios; distinguish mocked providers, deterministic fallback, API integration and browser results in the report.

## P2 — Expand beyond explicit personalization

9. **Design an auditable memory lifecycle and controlled persona evolution.**
   Acceptance: each fact has source, timestamp, confirmation, scope, expiry and correction/deletion behavior; persona defaults remain distinguishable from user facts; inferred preferences do not become clinical facts or consumption.

10. **Add retrieval, nutrition enrichment and recalibration only with measurable contracts.**
    Acceptance: query-aware catalog retrieval validates every selected item; reference-to-recipe calculations preserve serving/provenance/uncertainty; confirmed intake drives documented calculations. Graph scores and rules are never labeled clinical validation.

## Smallest viable demonstration

The most credible proposed slice is:

**Synthetic account → explicit budget change → visible confirmation → changed live catalog candidate set → refresh preserving the change.**

Then demonstrate:

- A recognized allergy resulting in an honest **unknown-coverage/no-candidate** response.
- A clearly labeled deterministic fallback when the provider is unavailable.
- Persistent account-scoped conversation history.

The corresponding paths and tests exist, but this demonstration has **not been executed in this audit**. (`backend/tests/test_agentic_profile.py:50–92,103–120,138–149`.)

Exclude claims of automatic taste learning, positive allergy safety certification, real payment/dispatch, and intake-driven recalibration until their missing connections are implemented and verified.

## Product-owner decisions required

1. When a user reports a **possible** allergy, what precaution applies immediately, for how long, and how can it be reviewed or cancelled?
2. Must hard allergy restrictions block **ordering**, or only recommendations? What is the policy for unknown recipe coverage?
3. Are budget and food dislikes strict exclusions or preferences that users may temporarily override?
4. What additional confirmation is required to remove an allergy, and which source wins when profile edits conflict with pending actions?
5. What does health-data consent cover—profile storage, chat storage, provider processing, inference—and what must withdrawal delete or disable?
6. May the assistant eventually add to cart, or only propose items? Checkout/payment should remain outside its scope unless explicitly approved.
7. What nudge frequency, quiet-mode duration and feedback controls should users receive?
8. Should incomplete photo estimates be loggable as partial observations, or must complete nutrition be supplied first?
9. Should persona-derived habits be stored as user memories at all, or retained solely as visibly separate defaults?

**No fixes or implementation changes were made.**
