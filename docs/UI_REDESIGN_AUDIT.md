# NutriSea UI audit

Audited 7 November 2026 on `fix/adaptive-preferences`. This is a page-by-page improvement of the existing application. Existing uncommitted frontend and backend changes are preserved; the starting frontend source and Git status are saved locally under `output/playwright/ui-redesign/`. No production data or credentials are used for UI tests.

## Existing architecture and constraints

- Next.js 16.4.2 App Router, React 19.3, TypeScript, plain global/module CSS, Lucide icons, Clerk 7.9.22. No new UI framework is needed.
- `frontend/AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `NUTRISEA_BUILD.md`, `SPECS.md`, installed Next client-component documentation, package scripts and test fixtures were inspected.
- Explicit locale: `src/app/layout.tsx` uses Clerk `enUS` and `<html lang="en">`. The owner's previous request explicitly selected English. This cleanup keeps English consistently; Indonesian dish and restaurant names remain proper catalog names.
- `AppShell`, `ShopeeHeader`, `BottomNav`, `RoleTabsBar`, `ShopeeFooter`, `AiAssistantModal`, `SeaBankModal`, and `DemoBar` form the shared shell. Global CSS already defines orange, neutral colors, 2/4/6/8px radius tokens and lightweight shadows. The implementation will consolidate the active shell styling without replacing all existing styles.
- `AppContext` owns cart, search/category, role views and local calculator/demo state. `AccountSessionGate/Controller` synchronizes Clerk and the server account. Canonical onboarding answers, allergy tokens, IDs and authorization remain unchanged.
- Data: `/api/dishes`, `/api/preferences/recommendation`, `/api/users/...`, `/api/scan`, `/api/ai/chat`, `/api/ai/actions/...`, `/api/ingredients`, and merchant/application routes. Recommendation ranking belongs to existing services; this pass only changes presentation.
- The named owner screenshots were not found in the inspected repository. New screenshots use their P01-P21 identifiers. Protected-route guest captures establish only the gate, never the signed-in layout. Existing earlier local captures are supplemental references, not the current baseline.

## Baseline verification

| Check | Actual result before edits |
| --- | --- |
| `npm run lint` | Fails: 20 existing errors, 48 warnings. Raw output: `output/playwright/ui-redesign/baseline-lint.txt`. |
| `npm run test` with system Node 22.14 | 52 pass, 3 test files fail to load because jsdom/undici requires newer Node APIs. |
| Node 24 equivalent of configured test command | 74 pass, 0 fail, 0 skipped. Raw output: `baseline-tests-node24.txt`. |
| `npm run typecheck` | Pass. |
| `npm run build` | Pass; 22 generated pages. |
| Live catalog | Intermittent timeouts previously observed; must distinguish empty/error/loading from loaded results. |

## Page inventory and implementation boundaries

Screenshot paths below are relative to `output/playwright/ui-redesign/`. Captures are attempted at 390 and 1366 pixels; final capture availability and blocked states are recorded in the implementation report.

| Page / route | Baseline screenshot | Actual source under `frontend/src/` | Baseline issue and proposed change | Risk | Verification |
| --- | --- | --- | --- | --- | --- |
| P01 `/` | `before-01-home-{width}.png` | `app/page.tsx` | Hero/BMI/AI blocks precede food; raw score branches; nested Add inside link. Compact recommendation strip, native separated links/actions, real prices, concise filters and image fallback. | Preserve search predicates, candidate ordering and actual availability. | Real catalog read, search/filter, Add, viewport screenshots. |
| P02 `/sign-in` | `before-02-sign-in-{width}.png` | `app/sign-in/[[...sign-in]]/page.tsx`, `auth.module.css` | Large auth framing and missing shopping exit. Compact form and return link. | Clerk verification and intended destination. | Guest form/keyboard inspection; real login blocked without credentials. |
| P03 `/sign-up` | `before-03-sign-up-{width}.png` | `app/sign-up/[[...sign-up]]/page.tsx` | Same framing; retain provider validation/terms. | Account creation writes. | Guest validation and static redirect review; no live account creation. |
| P04 `/cart` empty | `before-04-cart-{width}.png` | `app/cart/page.tsx`, `cart.module.css` | Oversized empty area. Short empty state and one browse action. | Cart persistence. | Guest empty transition and CTA. |
| P05 `/bmi` | `before-05-nutrition-bmi-{width}.png` | `app/bmi/page.tsx`, `bmi.module.css`, `profile.ts` | Competing panels and secondary finance content. Inputs/results first, optional detail. | Do not change formulas or saved profile fields. | Pure helper tests, guest calculations and mobile. |
| P06 `/scanner` | `before-06-food-scanner-{width}.png` | `app/scanner/page.tsx`, `analysis.ts`, `scanner.module.css` | Demo photo competes with upload; dense results. Upload first, optional estimates/detail. | Preserve missing values and explicit meal-log confirmation. | File acceptance, demo/failed state, helper tests; model call blocked. |
| P07 `/menu/[id]` | `before-07-menu-detail-{width}.png` | `app/menu/[id]/page.tsx` | Purchase controls below technical detail; unsupported kitchen choices; absent availability gating. Commerce first, expandable nutrition/graph, original catalog item passed to cart. | IDs, quantity, no inferred seller customization. | Real detail GET, Add quantity, network failure and fallback. |
| P08 `/merchant/register` | `before-08-merchant-registration-{width}.png` | `app/merchant/register/page.tsx`, `components/merchant/MerchantRegistrationPanel.tsx` | Inspect actual application state, compact form/status navigation. | Submission and ownership. | Existing isolated component tests; live submission blocked. |
| P09 `/merchant` | `before-09-merchant-dashboard-{width}.png` | `app/merchant/page.tsx` | Demo metrics/AI panels compete with menu operations. Prioritize actual menu management, move demos into optional detail. | CRUD and scoped authorization. | Code review, typecheck; authenticated CRUD blocked. |
| P10 `/admin` | `before-10-admin-dashboard-{width}.png` | `app/admin/page.tsx` | Demo operational claims and consumer chrome. Operational links first; demos qualified/collapsed. | Admin permissions. | Guard review; signed-in view blocked. |
| P11 `/admin/ingredients` | `before-11-admin-ingredients-{width}.png` | `app/admin/ingredients/page.tsx`, `components/ingredients/*` | Preserve functional table/search/units/dialogs; improve only demonstrated issues. | Numeric precision, deletion and permissions. | Existing isolated ingredient tests; live writes blocked. |
| P12 `/admin/merchant-applications` | `before-12-admin-merchant-applications-{width}.png` | `app/admin/merchant-applications/page.tsx` | Review approval/rejection confirmation and status clarity. | Access grant and irreversible review. | Source review, explicit confirmation; live approvals blocked. |
| P13 `/dashboard` | `before-13-dashboard-{width}.png` | `app/dashboard/page.tsx` | Inspect redirect/gate; avoid inventing an analytics dashboard. | Server-selected destination. | Preserve existing redirect; signed-in destination blocked. |
| P14 `/profile` | `before-14-profile-{width}.png` | `app/profile/page.tsx`, `profile-summary.tsx` | Review grouping of explicit facts versus template values. | No inferred diagnosis/history. | Static source and layout review; signed-in data blocked. |
| P15 `/profile/edit` | `before-15-profile-edit-{width}.png` | `app/profile/edit/page.tsx`, `profile-form.tsx` | Preserve grouped fields, validation, save/cancel. | Allergy relaxation and concurrent saves. | Existing helpers; actual persistence blocked. |
| P16 `/onboarding` | `before-16-onboarding-{width}.png` | `app/onboarding/page.tsx` | Role entry clarity and vertical density. | Authorization and redirects. | Guest gate; existing session tests. |
| P17 `/onboarding/personas` | `before-17-onboarding-personas-{width}.png` | `app/onboarding/personas/page.tsx`, `onboarding.module.css`, `services/onboarding-*` | Progressive flow already exists. Reduce decorative density, retain selection/back state/contracts. | Persona IDs, allergies, canonical answers. | Isolated contract tests; authenticated completion blocked. |
| P18 assistant | `before-18-ai-assistant-signed-out-{width}.png` | `components/AiAssistantModal.tsx` | Guest sees unnecessary conversation controls; floating control competes with checkout. Compact sign-in prompt, conventional authenticated chat, route-aware launcher. | Confirmation/profile actions, catalog grounding. | Guest dialog/focus/Escape; paid chat and persistence blocked. |
| P19 rewards | `before-19-seabank-rewards-signed-out-{width}.png` | `components/SeaBankModal.tsx` | Repetitive simulation text; retain disclosure and deliberate open. | No affiliation/payout claim. | Guest modal keyboard/focus; authenticated rewards blocked. |
| P20 demo guide | `before-20-demo-guide-{width}.png` | `components/DemoBar.tsx`, `AppShell.tsx` | Always in shopper shell; demo scenarios can mutate local demo state. Optional explicit presenter toggle; no default consumer/admin overlay. | Keep presenter access; do not add user-data writes. | Toggle, route navigation, review existing demo actions. |
| P21 `/cart` populated | `before-21-cart-with-item-{width}.png` | `app/cart/page.tsx`, `checkout.ts` | Broken image, wrapped actions, fake voucher/address/payment controls. Stable thumbnail; compact merchant/price/quantity rows; truthful configured demo adjustment and single disclaimer. | Backend totals/order confirmation. | Guest add/increment/remove/persistence; pure checkout tests; live order blocked. |

## Shared design decisions

Food photographs and actual rupiah prices provide the primary visual identity. Keep the orange header and existing logo; remove extra demo/role/wallet rows from normal shopping. Use a 1200px aligned container, existing restrained radius tokens, visible focus, 44px touch actions, and a compact footer with explicit independent-prototype disclosure. Use one reusable `FoodImage` fallback rather than substitute food photographs. Keep nutrition available with provenance, primarily in item details. Authenticated operation screens receive operational navigation rather than customer AI/demo overlays. No generated assets, new dependencies, backend schema changes, or ranking changes.
