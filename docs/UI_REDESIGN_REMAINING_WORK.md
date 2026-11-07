# Remaining UI and integration work

7 November 2026. These are unresolved or unverified items, not claims that protected workflows passed. Use test accounts and an isolated database; no production migrations/imports were run in this task.

## P0: authenticated regression verification

1. With a test Clerk customer, open a protected detail/profile destination, sign in, and verify the original destination. Register a separate test user, complete verification and onboarding, then sign out/in. Browser tests in this task used guest sessions only.
2. Save a profile containing dairy/egg/soy/wheat plus an unknown legacy allergy key and a muscle-gain goal. Reopen edit, cancel once, then save a harmless budget change. Verify all restrictions/goals persist. In a second tab change the profile before saving the first; verify stale-state rejection. The frontend reread is not an atomic backend version check.
3. With a test merchant, create/edit a test menu, switch availability, edit recipe quantities/units, and confirm ownership restrictions. Generate a description using a mocked provider first; try editing/closing/switching the form while generation is pending. Real model calls were not used.
4. With a test admin, review an application, cancel approval, reject with a reason, approve another test application, then resync access. Verify recorded status and access with a fresh session. Isolated confirmation tests pass; live permission/state changes remain unverified.
5. Place a simulated order only in an isolated test database. Verify backend recalculated prices, configured delivery/credit/adjustment, errors retaining the cart, confirmation ID, and duplicate-click behavior. UI quantities/totals/persistence passed; actual orders were not created here.

## P1: backend-derived catalog and reference limitations

- `backend/app/api/dishes.py` still supplies fallback merchant/district, rating/sales/distance and availability values. Ratings/sales/distance were removed from customer presentation. Reproduce by serializing a record lacking those values; add explicit provenance/unknown fields in a separately reviewed backend change. Merchant identity and availability still inherit API limitations.
- Catalog image URLs may be stock illustrations rather than photographs of the actual restaurant serving. The UI uses existing catalog URLs and shows a neutral fallback on failure; no substitute food images are fabricated. Verify image provenance with catalog owners.
- Cart delivery/credit and adjustment currently follow backend demo constants. There is no real address/payment/voucher integration. Before enabling those controls, add genuine server-supported choices and total validation; do not restore decorative selectors.
- Ingredient source tables are migration-only. If Nutrition reference returns unavailable, inspect the isolated environment's schema and apply reviewed migration 004 only to an explicitly selected non-production database. The import CLI's dry run connects to its configured database; do not run it against production casually.
- Incoming ingredient importer constructs its nutrition lookup before duplicate serving-ID validation. Review duplicate-row handling before using new source files: two conflicting nutrient rows for one serving must not silently overwrite. No import was run here.

## P1: AI and scanner verification

- Authenticated chat retains free-form model replies and confirmation actions; no paid chat test was performed. Use mocked replies/candidate sets and an isolated account to verify catalog grounding, missing-match behavior, error recovery and expired/rejected profile actions. Do not interpret visible chat UI as proof every reply is grounded.
- Run scanner with representative real images through an approved test provider. Confirm estimates/uncertainty, incomplete measurement rejection, explicit confirmation and meal logging. Local upload/demo/error tests passed; model accuracy and persisted logs remain unverified.
- Menu graph and AI disclosures preserve existing endpoints. Verify with a test account and known catalog ID; application rules are not medical validation or allergen guarantees.

## P2: test tooling and remaining lint

- Reproduce Node runtime issue with `npm run test` under Node 22.14: three DOM test files fail at jsdom/undici startup. Use Node 24 (documented in implementation report) or deliberately align runtime/dependency support in a tooling change.
- `npm run lint` still reports existing hook-effect and typing errors. Compare `output/playwright/ui-redesign/baseline-lint.txt` and final logs; do not resolve them by disabling checks globally.
- Complete signed-in responsive screenshots at 390, 768 and 1366 pixels; guest gates cannot verify protected page appearance. Check real mobile keyboard and assistive technology, beyond desktop browser viewport simulation.
- Re-capture the populated-cart before state only from an appropriate original source checkout. The current baseline P21 capture raced hydration and cannot support a valid before/after populated-cart comparison.

Screenshots and temporary evidence are local under `output/playwright/`; they have not been committed or pushed. Existing unrelated changes and local database backups were preserved.
