# UI cleanup implementation report

## Current status: visual redesign rolled back

On 7 November 2026, the owner requested that the visual redesign be reverted. The sections below describe the earlier implementation and are retained as historical evidence, not the current visual state.

Restored the pre-redesign source snapshot for the shared navigation/header/footer, home and food detail, cart, BMI/scanner, authentication and profile presentation, and merchant/admin layouts. Removed the redesign-only commerce and admin styles. English localization remains. Onboarding already matched the saved baseline and was left unchanged.

Retained authentication/bootstrap fixes, backend AI work, profile allergy/goal preservation and stale-save checks, cart state and validation, image fallbacks, ingredient nutrition references, merchant description preview/Apply/Discard and cancellation, and admin confirmations. Unsupported kitchen requests still cannot overwrite catalog preparation notes. Restored merchant metric cards show unavailable values where no real metric exists; the demo draft action does not save or call a model automatically.

Rollback verification: Node 24 `npm run test` **85 passed, 0 failed, 0 skipped**; `npm run typecheck` and `npm run build` passed. `npm run lint` still reports **17 errors and 23 warnings**. Ten browser assertions passed for restored navigation, real catalog loading/search, cart quantities/persistence/removal, BMI validation and rewards dismissal. Captured 24 states at 390, 768 and 1366 pixels with no document-width overflow or broken image elements observed. Authenticated merchant/profile workflows remain unverified. No backend files, migrations, or production data were changed.

Local rollback evidence: `output/playwright/ui-rollback/` (ignored by Git). The rollback is a new commit; earlier pushed history is preserved.

## Earlier implementation record

7 November 2026. Work began on `fix/adaptive-preferences` at `95e1c04`, preserving the existing dirty working tree. The owner then requested the latest merchant feature branch: `origin/feat/new-merchant` was fast-forwarded to `1e0dc23`, including ingredient-provenance commit `667cfe7`. Local UI and other unfinished work were retained using autostash `35a3608`; the backup remains available. This task did not run a push, production database migration, ingredient import, account creation, payment, or paid AI test. A separate upstream-ref update is present in the repository reflog; local UI edits remain uncommitted.

## Visible result

The orange header now occupies about 102px on the checked desktop instead of approximately 237px. Food cards begin around y310-334 instead of y586. Search, understandable filters, actual catalog meals, prices and Add actions appear in the first viewport. The persistent role/wallet/demo rows are removed from the shopping shell; presenter tools remain opt-in from the footer. The mobile assistant opens from navigation, and cart navigation is in document flow so it cannot cover checkout.

The explicit English locale (`enUS`, `lang="en"`) and the owner's earlier English preference were retained. Proper Indonesian dish/merchant names and canonical backend values are unchanged. The footer clearly identifies the app as an independent prototype, without an official ShopeeFood or SeaBank integration.

## Page-by-page status

`IMPLEMENTED` means code changed and the specified public/isolated checks ran. `PARTIAL` means code changed but a protected/model-dependent workflow remains unverified. `PREEXISTING` means the audited implementation was retained intentionally. `BLOCKED` describes a particular verification, not invented completion of the whole page.

| Page | Status | Change and verification |
| --- | --- | --- |
| P01 Home | IMPLEMENTED; personalized runtime PARTIAL | Compact suggestion row, four/three/two-column food grid, 2-line titles, native separate links/Add buttons, skeleton loading, human-readable filters with numeric threshold titles. Removed raw ranking scores and unsupported rating/sales/distance displays. Live catalog showed 100 records; filters, search reset, keyboard navigation and Add were tested. Authenticated recommendations require test credentials. |
| P02 Sign-in | PARTIAL | Compact Clerk form, one provider-controlled heading, shopping exit and preserved destination configuration. Guest rendering verified; actual login/logout is BLOCKED without a test account. |
| P03 Sign-up | PARTIAL | Same compact auth treatment; Clerk retains field/password/verification instructions. No account created, so verification and onward registration remain BLOCKED. |
| P04 Empty cart | IMPLEMENTED | Short empty state and one browse action; tested remove-to-empty, persistence and return to catalog. |
| P05 BMI | IMPLEMENTED; save PARTIAL | Inputs and energy/BMI remain prominent; nutrition/calculation/plate details are optional; unrelated finance promotion removed. Formulas preserved. Valid/invalid inputs, keyboard details and isolated save-payload safeguards tested. Authenticated save not performed. |
| P06 Scanner | IMPLEMENTED; model/logging PARTIAL | Starts with upload rather than preselected sample. Demo samples and nutrient details are optional. Input retained after analysis error; estimates, missing measurements and demo logging restrictions preserved. PNG MIME, invalid-file behavior, demo/error states tested; actual model and meal-log calls BLOCKED. |
| P07 Menu detail | IMPLEMENTED; graph/AI PARTIAL | Actual image/name/seller/price/availability and quantity/Add precede optional nutrition, preparation, graph and AI sections. Removed unsupported kitchen customization. Distinct missing-item/load-error states. Quantity 2 preserved original DISH-01 ID and catalog preparation notes in guest cart. Authenticated graph/AI calls not run. |
| P08 Merchant registration | PREEXISTING | Existing form/status component and endpoints retained; shared shell improved. Seven isolated registration tests passed. Actual submission/status persistence BLOCKED. |
| P09 Merchant dashboard | PARTIAL | Real outlet/menu operations prioritized. Removed fabricated KPI cards and direct demo-demand catalog insertion. Failed estimation retains inputs; missing nutrition starts blank and measured zero survives. Presenter action opens an unsaved draft without automatic model calls. Incoming description-generation feature integrated separately; authenticated CRUD/model calls remain BLOCKED. |
| P10 Admin dashboard | PARTIAL | Operational links and catalog information first; fabricated financial fallback KPI removed; demand examples optional without invented search/growth metrics. Explicit confirmation before hygiene-flag action. Guard visible; signed-in operation BLOCKED. |
| P11 Ingredients | PREEXISTING editor; merged nutrition PARTIAL | Existing search, quantity/unit validation and native dialogs retained; sign-in guard retains destination. Incoming reference-nutrition viewer integrated with English interface and missing-value/provenance safeguards. Isolated tests verify interactions; actual admin CRUD BLOCKED. |
| P12 Merchant applications | PARTIAL | Added a review component requiring explicit confirmation for approve, reject and access resync; reason and failure state retained. Three isolated confirmation tests passed. Live approval/rejection BLOCKED. |
| P13 User dashboard | PREEXISTING | Server-selected routing retained; no fabricated analytics or consumption history introduced. Guest redirect verified; authenticated destination BLOCKED. |
| P14 Profile | PARTIAL | Personal facts/preferences prioritized; business signup moved below them. Saved allergy labels and muscle goal preserved. Signed-in data rendering BLOCKED. |
| P15 Profile edit | PARTIAL | Fixed loss of non-peanut/seafood allergies and GAIN_MUSCLE goal. Retains unknown saved allergy keys, aligns validation and rereads current profile before save. Three pure tests passed; authenticated save/cancel flow BLOCKED. Freshness check is not an atomic server concurrency guarantee. |
| P16 Role onboarding | PREEXISTING | Existing route/role guards retained; no unnecessary rewrite. Guest redirect verified, session regressions tested; signed-in role flow BLOCKED. |
| P17 Persona onboarding | PREEXISTING | Existing progressive questions, back selection state, canonical answers and template presentation retained. Six contract tests passed. Authenticated completion BLOCKED. |
| P18 Assistant | PARTIAL | Small guest sign-in dialog with return destination; conventional authenticated drawer retained. Mobile nav entry, focus containment, Escape, focus restoration and scroll lock tested. Profile confirmation actions unchanged. Free-form authenticated/model replies and catalog grounding not tested; no new speculative purchase links or automatic cart actions added. |
| P19 Rewards | IMPLEMENTED guest; authenticated PARTIAL | Short, explicit simulation/no-affiliation disclosure, deliberate footer action, accessible close/Escape and scroll lock. No automatic opening on cart navigation. Real account reward reads BLOCKED. |
| P20 Demo guide | IMPLEMENTED | Opt-in presenter toggle; hidden from ordinary shopper and admin workflows, local-state disclosure and existing scenarios retained. Toggle/open/close verified without executing model/order scenarios. |
| P21 Populated cart | IMPLEMENTED; checkout PARTIAL | Stable FoodImage thumbnail/fallback, merchant/unit price/quantity/subtotal/remove rows, read-only optional preparation notes, one simulation disclaimer. Unsupported voucher/address/payment selectors removed. Default backend fee/credit/adjustment totals retained. Guest 1→2 quantities, doubled subtotal/total, persistence, removal and broken image tested. Actual order creation BLOCKED. |

## Exact cleanup files

All paths below are under `frontend/`, except the mandatory reports. Files already dirty before the task were edited in place without discarding earlier fixes.

- `package.json`: include image and profile regression tests in the configured test command.
- `src/app/layout.tsx`, new `src/app/commerce-shell.css`: shared shell tokens/styles and truthful prototype metadata.
- `src/components/AppShell.tsx`, `ShopeeHeader.tsx`, `ShopeeFooter.tsx`, `BottomNav.tsx`: compact navigation, operational navigation, footer and optional presenter controls.
- `src/components/AiAssistantModal.tsx`, `SeaBankModal.tsx`, `DemoBar.tsx`: guest dialogs, focus/scroll behavior, mobile launcher and optional demo guide.
- New `src/components/FoodImage.tsx`, `food-image.module.css`, `FoodImage.test.tsx`: real-image error handling without fabricated replacement photos.
- `src/app/page.tsx`, `src/app/menu/[id]/page.tsx`, new `src/app/commerce.module.css`: food-first discovery/details.
- `src/app/cart/page.tsx`, `cart.module.css`; `src/app/bmi/page.tsx`, `bmi.module.css`; `src/app/scanner/page.tsx`, `scanner.module.css`.
- `src/app/auth.module.css`, `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/sign-up/[[...sign-up]]/page.tsx`.
- `src/app/profile/profile-form.tsx`, `profile-summary.tsx`, `profile-types.ts`, `profile.module.css`, new `profile-types.test.ts`.
- `src/app/merchant/page.tsx`; `src/app/admin/page.tsx`, new `admin.module.css`; `src/app/admin/merchant-applications/page.tsx`.
- `src/components/ingredients/IngredientGuard.tsx`, `ingredients.module.css`; new `src/components/merchant/ApplicationReviewCard.tsx`, `ApplicationReviewCard.test.tsx`.
- `docs/UI_REDESIGN_AUDIT.md`, this report, and `docs/UI_REDESIGN_REMAINING_WORK.md`.

Incoming branch files are independently visible with `git show --stat 667cfe7` and `git show --stat 1e0dc23`; they are not represented as newly authored UI work. The merge includes the ingredient source schema/routes/services, import tooling/docs/tests, merchant description endpoint, and reference-nutrition UI. No source import or migration was executed.

## Commands and evidence

Run frontend commands from `frontend/`. System Node is 22.14; the installed jsdom/undici combination needs newer runtime APIs. Baseline `npm run test` under Node 22 had 52 passes and 3 file-load failures. Node 24 is used for complete DOM tests:

```powershell
$uiNodeDir = 'C:\Users\Victus\AppData\Local\npm-cache\_npx\387698761821791d\node_modules\node\bin'
$env:Path = "$uiNodeDir;$env:Path"
& "$uiNodeDir\node.exe" C:/nvm4w/nodejs/node_modules/npm/bin/npm-cli.js test
npm run typecheck
npm run lint
npm run build
```

Before the merchant merge: **82 tests passed, 0 failed, 0 skipped**; typecheck and build passed. Full lint still fails, improved from baseline **20 errors/48 warnings** to **17 errors/18 warnings**. Remaining lint findings include existing effects and untyped graph/merchant code; this report does not claim a lint-clean repository.

Browser commands use `npx --yes --package @playwright/cli playwright-cli -s=redesign run-code --filename <script>` from repository root. Reproducible scripts/results live under `output/playwright/ui-redesign/`. Backend-mutating requests were blocked in browser tests.

- `after-pages.js`: 63 captures at 390×844, 768×900 and 1366×900, with zero document-width overflow and zero broken image elements in those captured states. Some captures are protected-route gates, not authenticated screens.
- `check-shell.js`: 15 passed assertions for guest dialogs, focus/Escape/scroll, opt-in demo guide, mobile cart navigation and operational admin navigation.
- Cart/BMI/scanner focused script: 29 assertions passed for actual catalog cart state/totals, fallback, scanner errors/MIME and calculator inputs.
- `output/playwright/commerce-cleanup/results.json`: eight extra home/detail captures at 375×667, 390×844, 768×1024 and 1440×900; no overflow or undersized visible main action buttons. Filter counts: All 100, budget 57, protein 33, lower calorie 90, coconut label 21, stomach category 45. Search/reset and detail keyboard/quantity checks passed.
- Contrast checker: white on header `#d23f20` = 4.70:1; white on action `#c43e20` = 5.18:1. This checks these pairs, not every legacy color in the repository.

The initial P21 baseline screenshot was captured before cart hydration and shows an empty cart; it is not evidence of the old populated-cart layout. The settled after P21 captures show the actual catalog item. Protected-route screenshots show gates only. Some screenshots include Next development tooling, which is not production UI.

## Merge verification

The fast-forward succeeded. Four autostash overlaps required reconciliation: database pool configuration, merchant page, ingredient autocomplete, and ingredient management. Keep the incoming configurable bounded pool and migration-only source-table exclusions; retain local UI safeguards, English copy and validation while integrating incoming features. The pre-merge stash and binary patch are retained locally.

All four overlaps are resolved and there are no unmerged index entries. The incoming pool configuration uses defaults of two connections, zero overflow and a ten-second timeout, replacing local hardcoded two-plus-one limits while retaining a bounded pool. Source-table migration exclusions and the isolated test environment guard are preserved. The working index was returned to its original unstaged state; unrelated AI/backend edits compare unchanged against the stash.

The incoming merchant feature received narrow integration fixes in `frontend/src/app/merchant/page.tsx` and `backend/app/api/merchant.py`: generation now produces a reviewable preview with Apply/Discard, aborts stale context requests, never saves automatically, accepts the existing 100-item recipe limit, and returns `source: ai_generated | input_template`. Missing AI configuration skips provider construction/calls. Template fallback includes only supplied facts, with no invented freshness/spice claims. Added `backend/tests/test_merchant_description.py` with mocked providers.

The merged `IngredientAutocomplete.tsx`, `IngredientManagement.tsx`, `IngredientNutrition.tsx`, `IngredientNutrition.test.tsx` and `services/ingredient-nutrition.ts` retain the incoming nutrition viewer and the local English/accessibility changes. `src/lib/api-error-messages.ts` translates the exact new unavailable-reference error; raw provider text and values remain unchanged.

Post-merge verification:

| Command | Result |
| --- | --- |
| Node 24 configured `npm run test` command above | **85 passed, 0 failed, 0 skipped**. |
| `npm run typecheck` | Pass. |
| `npm run build` | Pass. |
| `npm run lint` | 17 existing errors, 18 warnings; not clean. |
| `backend/.venv/Scripts/python.exe scripts/run_backend_tests.py test_ingredient_data.py` | **15 passed**, isolated SQLite. |
| `backend/.venv/Scripts/python.exe scripts/run_backend_tests.py test_merchant_description.py` | **5 passed**, mocked provider and isolated runner. |
| `git diff --check` and unmerged-path check | Pass; no conflict markers/unmerged entries. |

Raw logs: `output/playwright/ui-redesign/post-merge-{tests,build,lint}.txt`. Visual comparison: `output/playwright/ui-redesign/comparison.html`. The new protected merchant preview and reference viewer were tested through isolated code/component tests, not a live signed-in merchant session.

The existing local backend runs with reload enabled and `AUTO_CREATE_TABLES=false`. A read-only request to `http://127.0.0.1:8000/openapi.json` confirms that `/api/merchant/generate-description` and `/api/ingredients/{ingredient_id}/nutrition` are registered. This verifies route availability only; it does not verify authentication, source-table contents, or a live provider response.
