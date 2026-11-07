# Clerk session authorization

Clerk public metadata is the source of account permissions. Browser UI reads
`useAuth().sessionClaims.metadata`. API requests carry `getToken()` as a Bearer
token; FastAPI verifies RS256, JWKS, issuer, expiry, authorized party and required
claims before reading the same `metadata` claim. Neither `unsafeMetadata`, UI
role preferences, `app_user.role`, nor approved application rows grant access.

## Required instance configuration

Configured and read back successfully on 7 November 2026 for the project's
development instance `ins_3L6J4VQkEis9ZjBubDhU5b7Tz9k`. Before applying this,
the instance returned `session: null`. The reviewed CLI patch is stored in
[`frontend/clerk.session.config.json`](../frontend/clerk.session.config.json).
It sets the metadata claim with the default 60-second token lifetime and
5-second allowed clock skew. Existing browser sessions must fetch a fresh
token; the application's retry already uses `getToken({skipCache:true})`.

In Clerk Dashboard → Sessions → Customize session token, merge this claim into
the existing configuration and save:

```json
{
  "metadata": "{{user.public_metadata}}"
}
```

Keep public metadata limited to role and merchant IDs; do not put health data,
credentials or large profile fields in it. Missing metadata is an explicit
session/configuration error. An empty metadata object means CONSUMER. Unknown
roles and malformed merchant IDs are rejected by both frontend and backend.

Public metadata examples:

```json
{"role":"CONSUMER","merchant_ids":[]}
```

```json
{"role":"MERCHANT_ADMIN","merchant_ids":["MTR-existing-id"]}
```

```json
{"role":"SHOPEE_ADMIN","merchant_ids":[]}
```

Use the operator-only `scripts/set_account_access.py` to assign roles. Do not
copy roles from unsafe metadata or legacy database roles. To preserve existing
approved memberships when upgrading:

```powershell
python scripts/migrate_merchant_access_to_clerk.py
python scripts/migrate_merchant_access_to_clerk.py --apply
```

## Approval and session freshness

The customer landing page, menu detail pages and cart are public. Guests can
browse, filter and add dishes without login. Checkout redirects guests to
`/sign-in?redirect_url=%2Fcart`; tab-scoped cart storage retains their selections
through login. Order creation requires a verified Clerk session for the same
user ID. A failed request leaves the cart intact and does not show success.

Once per signed-in session, `POST /api/auth/bootstrap` derives the account ID
from Clerk auth and writes `role: CONSUMER` only when role is absent, null or
empty. Existing assignments are preserved. The browser forces a session token
refresh, validates metadata readiness and then calls authenticated
`POST /api/users/sync`. Only that backend response determines onboarding status:
a valid assigned persona AND the account's own persisted health profile must
both exist. Clerk unsafe metadata and browser storage never decide completion.

A new consumer is sent to `/onboarding/personas`: the existing profile form,
eight questions, reference-persona matching and explicit confirmation. The
confirmation saves entered profile, selected personas and generated memories
in one database transaction. Reference persona biometrics, allergies and
medical conditions are not copied into the customer profile. On success the
shared account snapshot is reloaded; any write failure keeps the form available
for retry. No private health data is duplicated into Clerk metadata.

`AccountSessionContext` supplies the same account snapshot to home, profile,
BMI and menu detail pages. Account changes abort stale requests, discard the
previous snapshot and reset child UI state. Guest cart items survive login,
while another authenticated account's cart is cleared. All `/api/users` routes
require a valid session and matching path account ID. Checkout also requires
completed onboarding.

The origin check compares browser Origin against HTTP Host rather than Next's
internal bind address. External origins and cross-site requests are rejected.
Missing custom session claims are an explicit configuration error with retry.
See [the audit](./auth-onboarding-audit.md) for evidence and validation scope.

Approval commits merchant resources and the application record first, then
publishes merchant access to Clerk. If Clerk is unavailable, the endpoint
returns 503; retry APPROVED review on the same application to finish syncing.
Retries reuse the merchant ID and do not create another merchant. The database
approval alone gives no permissions. The legacy user role may be mirrored by
user sync but is never read for authorization.

Clerk renews session tokens periodically. After approval, the registration page
forces `getToken({skipCache:true})`; focusing the window also forces renewal.
The UI reads the updated session claims. Existing JWTs remain usable until
their expiry; revocation of a metadata role therefore follows token freshness,
not an immediate per-request Backend API lookup. Changing localStorage cannot
grant API permissions. Backend secret key is needed for operator metadata
writes, not for each authenticated request.

References: [session token customization](https://clerk.com/docs/guides/sessions/customize-session-tokens),
[force token refresh](https://clerk.com/docs/guides/sessions/force-token-refresh).
