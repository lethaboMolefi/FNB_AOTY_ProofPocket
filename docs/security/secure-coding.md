# Secure coding standard

These rules apply to every change. The pull-request checklist (`.github/pull_request_template.md`) asks for each one, and CI checks the ones a machine can check.

## Authorisation

1. Every API route runs `requireUser([...roles])` (or is explicitly public), and every database call runs inside `withContext()`, so row-level security sees the caller.
2. Roles, organisations and company ownership come from the database, never from the request body, headers or the token's claims.
3. Every new table enables RLS and gets policies in a migration. The RLS coverage test (`security.test.ts`) fails otherwise.
4. Columns that only one party may change (Verified, support stage, sharing, role) get a protecting trigger as well as a policy.
5. Business rules (readiness, flags, eligibility, payment checks) live in `packages/shared/src/rules`, with tests written first, and the server's answer is the one that counts.

## Input and output

6. Every request body, query and route parameter is parsed with a Zod schema from `packages/shared` before use.
7. SQL is written with Drizzle or the `sql` template, never by joining strings. Arrays and ids are passed as parameters.
8. The web app never uses `dangerouslySetInnerHTML`, `eval` or inline scripts; the CSP (`script-src 'self'`) would block them anyway.
9. Uploads go straight to storage through a signed URL with a fixed size and type. The API checks the real type from the file's first bytes and computes the SHA-256 itself. Downloads are 5-minute signed links served as attachments.

## Secrets and personal data

10. No secrets in code, tests or git: keys come from Secret Manager in production and are generated per run in tests. gitleaks runs on every push.
11. Never log ID numbers, account numbers, PINs, codes, passwords, tokens or file contents. Add new sensitive field names to `REDACT` in `app.ts`. Never log request bodies.
12. Account numbers and authenticator secrets are encrypted with AES-256-GCM (`lib/crypto.ts`). Only the last four digits of an account number are shown.
13. Error messages to users are plain and generic ("That email and password don't match"); they never say whether an account exists.
14. New personal data, or a new place it goes, is added to the privacy notice and `docs/security/popia/processing-register.md` in the same pull request.

## Money and integrations

15. ProofPocket never holds or moves money, never calls bank APIs and never posts through social media APIs (share links only).
16. Records are voided, never deleted. `audit_log` and `offers` are append-only; never add an UPDATE or DELETE path to them.

## Dependencies

17. Ask before adding a dependency. Pin it exactly, use the latest stable version that is at least 24 hours old, and keep pnpm's release-age rule and build-script allow-list on.
18. `pnpm audit --audit-level high` must pass. A high finding that can't be fixed gets a written exception with an expiry date in the pull request.

## Configuration

19. Production refuses development settings at start-up (dev or local sign-in, console mail, local storage, per-instance rate limits). Add a check to `config.ts` for any new setting that would be unsafe in production.
20. Infrastructure changes go through `infra/deploy.sh`, so they're repeatable and reviewed.
