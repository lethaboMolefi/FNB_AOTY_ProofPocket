# OWASP ASVS 4.0.3 Level 1 checklist

ASVS Level 1 is the minimum the requirements ask for. Each chapter lists its Level 1 requirements, grouped where several share one answer.

**Status:** ✅ met, with evidence · ➖ not applicable, with the reason · 🟡 partly met (see `not-implemented.md`)

## V1 Architecture (Level 1 has few items)

| Req | Status | Evidence |
|---|---|---|
| 1.2.x Authentication architecture | ✅ | One verifier (Firebase) in production; dev and local modes refused by config (`config.ts`) |
| 1.4.x Access control architecture | ✅ | Server checks plus RLS (`withContext`, `0001_rls.sql`); `threat-model.md` |
| 1.14.x Deployment | ✅ | Built from the committed code (`git archive`), private DB, separate service account |

## V2 Authentication

| Req | Status | Evidence |
|---|---|---|
| 2.1.1–2.1.12 Passwords (at least 12 characters, no composition rules, paste allowed, show/hide, common-password check) | ✅ / 🟡 | Join and local sign-up require ≥ 12 characters, refuse common passwords and passwords built from the email name (`auth.test.ts`). In production people sign up with Firebase directly, so the same minimum must also be set in Firebase's password policy, with Firebase's breached-password protection (2.1.7). That is a project setting for the owner (`not-implemented.md`) |
| 2.2.1 Anti-automation | ✅ | Account lockout after 5 tries; per-IP limits shared across instances (`security.test.ts`) |
| 2.2.2 Weak authenticators (SMS/email) not used for step-up | ✅ | Google Authenticator only |
| 2.2.3 Notify on changes | ✅ | Payment detail changes notify the incubator's advisers (`payments.test.ts`) |
| 2.3.1 Initial passwords | ✅ | Generated, strong, never mailed in the clear (`infra/firebase_users.py`) |
| 2.5.x Credential recovery | ✅ | Firebase reset email; same answer whether or not the account exists (`SignIn.tsx`) |
| 2.7.x / 2.8.x Out-of-band and one-time codes | ✅ | TOTP RFC 6238, one step of drift, single use, lockout (`totp.test.ts`, `api.test.ts`) |

## V3 Session management

| Req | Status | Evidence |
|---|---|---|
| 3.1.1 No tokens in URLs | ✅ | Bearer header only; the payment page token goes in `X-Pay-Token`, not the query |
| 3.2.x New token at sign-in, unguessable | ✅ | Firebase ID tokens; local tokens HMAC-signed (`session-token.ts`) |
| 3.3.1 Logout invalidates the session | ✅ | Firebase sign-out; local token removed; the cache of the founder's data is cleared |
| 3.4.x Cookie attributes | ➖ | No cookies are used |
| 3.7.1 Re-authentication for sensitive actions | ✅ | Google Authenticator code to change payment details or turn off two-step sign-in |

## V4 Access control

| Req | Status | Evidence |
|---|---|---|
| 4.1.1–4.1.5 Enforced on the server, least privilege, deny by default | ✅ | `requireUser`, RLS with no default access (`rls.test.ts`: "without context the app role sees nothing") |
| 4.2.1 IDOR protection | ✅ | `security.test.ts` (another company's file, funder without consent) |
| 4.2.2 CSRF | ➖ | No cookies; bearer tokens aren't sent automatically by the browser |
| 4.3.1 Admin interfaces need two-step sign-in | ✅ | Required for admin, funder and adviser |

## V5 Validation, sanitisation and encoding

| Req | Status | Evidence |
|---|---|---|
| 5.1.x Input validation, allow-lists | ✅ | Zod schemas with enums and limits (`packages/shared/src/schemas`) |
| 5.2.x Sanitisation, no eval | ✅ | No HTML input; no `eval` or `dangerouslySetInnerHTML` (ESLint, Semgrep) |
| 5.3.x Output encoding, injection | ✅ | React escaping, parameterised SQL (`security.test.ts` XSS and SQL injection; e2e `security.spec.ts`) |
| 5.5.x Deserialisation | ✅ | JSON only, 100 kB limit, parse errors return 400 |

## V6 Cryptography

| Req | Status | Evidence |
|---|---|---|
| 6.2.1–6.2.3 Approved algorithms, fail securely | ✅ | AES-256-GCM with a 16-byte tag, SHA-256, scrypt, HMAC-SHA256 (`crypto.ts`, `passwords.ts`) |
| 6.4.x Key management | ✅ | Keys in Secret Manager; generated per run in tests |

## V7 Errors and logging

| Req | Status | Evidence |
|---|---|---|
| 7.1.1–7.1.4 No credentials or personal data in logs; security events logged | ✅ | `REDACT`; `audit_log` records security events (`security.test.ts` logs) |
| 7.4.1 Generic error messages | ✅ | `{ error: { code, message } }` with no stack traces (`api.test.ts`) |

## V8 Data protection

| Req | Status | Evidence |
|---|---|---|
| 8.2.1 No caching of sensitive data | ✅ | Documents, proofs and payment pages never cached; `Cache-Control: no-store` on downloads and exports |
| 8.2.2 Data in browser storage | ✅ | Only the founder's own reads and an outbox scoped to the account; cleared or warned at sign-out |
| 8.2.3 Data removed at logout | ✅ | Sign-out clears the founder's API cache (the message name was fixed on 25 October 2026) |
| 8.3.1 Sensitive data not in URLs | ✅ | Ids only; payment links use a reference plus a random token |
| 8.3.2 Users can export and delete their data | ✅ | Download my data; deletion requests (`security.test.ts`) |
| 8.3.3 Clear notice and consent | ✅ | `/privacy-notice`; consent version recorded |
| 8.3.4 Sensitive data identified, with a policy | ✅ | `popia/processing-register.md`, `retention-schedule.md` |

## V9 Communications

| Req | Status | Evidence |
|---|---|---|
| 9.1.1–9.1.3 TLS everywhere, strong configuration | ✅ | Google-managed TLS for Hosting and Cloud Run; HSTS with preload; DB `ENCRYPTED_ONLY` with verify-ca |

## V10 Malicious code

| Req | Status | Evidence |
|---|---|---|
| 10.3.1–10.3.3 Update integrity, no subdomain takeover | ✅ | PWA updates only from the same origin through the service worker; no custom subdomains |

## V11 Business logic

| Req | Status | Evidence |
|---|---|---|
| 11.1.1–11.1.5 Steps in order, realistic timing, limits, anti-automation | ✅ | Join wizard order enforced on the server; proof checks; duplicate money-out confirmation; rate limits (`rules.test.ts`, `payments.test.ts`) |

## V12 Files and resources

| Req | Status | Evidence |
|---|---|---|
| 12.1.1 Size limits | ✅ | 5 MB, enforced by the signed URL and checked again (`security.test.ts`) |
| 12.3.x No path traversal or user-controlled paths | ✅ | Storage paths are `company/purpose/uuid`; local store refuses paths outside its folder |
| 12.4.x Files stored outside the web root, not executed | ✅ | Private bucket; uniform access; public access prevention |
| 12.5.x Served safely | ✅ | `attachment`, `nosniff`, `sandbox` CSP (`security.test.ts`) |
| 12.6.1 No SSRF | ✅ | The API never fetches a user-supplied URL |

## V13 API and web services

| Req | Status | Evidence |
|---|---|---|
| 13.1.x Same encoding, admin API protected | ✅ | JSON only; admin routes need the admin role and Google Authenticator |
| 13.2.x Methods, content type, JSON schema | ✅ | Express routes per method; Zod on every body; OpenAPI at `/api/v1/openapi.json` |

## V14 Configuration

| Req | Status | Evidence |
|---|---|---|
| 14.2.x Dependencies up to date, from trusted sources | ✅ | Exact pins, release age, `pnpm audit`, SBOM, Dependabot |
| 14.3.x No debug, no version leaks | ✅ | `x-powered-by` off; no source maps hosted (`firebase.json` ignores `*.map`) |
| 14.4.x Security headers | ✅ | CSP, HSTS, `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy (ZAP FAIL rules) |
| 14.5.x Request validation, CORS | ✅ | CORS allows only the hosted web origins |

**ZAP findings accepted as warnings:** Cross-Origin-Embedder-Policy (90004) would block Google Fonts and Firebase sign-in pop-ups. Sub-resource integrity (90003) can't be used for the Google Fonts stylesheet because its content changes with the browser. The IGNORE rules in `.zap/rules.tsv` are informational (minified-bundle comments and timestamps, cacheable static assets, "modern web app") or not applicable (anti-CSRF tokens, since there are no cookies).
