# Security testing

What runs, when it runs, and the results on 25 October 2026.

## 1. Automated checks on every push and pull request (`.github/workflows/ci.yml`)

| Check | Tool | Breaks the build when |
|---|---|---|
| Lint, including security rules | ESLint, eslint-plugin-security | Any error |
| Type check | TypeScript | Any error |
| Business-rule, API and security tests | Vitest, Supertest, real PostgreSQL 18 | Any test fails |
| End-to-end on phone and desktop, under the production CSP | Playwright, production build | Any test fails |
| Dependency vulnerabilities | `pnpm audit --audit-level high --prod` | A high or critical advisory |
| Static analysis | Semgrep `p/default`, `p/typescript`, `p/nodejsscan` | Any finding |
| Secrets in history | gitleaks | Any secret |
| Dynamic scan of the web build and the API | OWASP ZAP baseline with `.zap/rules.tsv` | Any FAIL rule (headers, cookies, CORS, error disclosure) |
| Software bill of materials | `pnpm sbom` (CycloneDX) | Generation fails (kept as an artifact for 90 days) |

CI also runs weekly (Mondays), so new advisories in unchanged dependencies are caught. `zap-hosted.yml` scans the live site every Monday at 05:00 South African time.

## 2. Running them yourself

```
cd system
pnpm lint && pnpm typecheck
pnpm test                              # needs pnpm db:up
pnpm test:e2e
pnpm audit --audit-level high --prod
pnpm sbom --sbom-format cyclonedx --lockfile-only --out sbom.cdx.json
docker run --rm -v "$PWD/../.zap:/zap/wrk" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t https://proofpocket-aoty.web.app -c rules.tsv -I
```

## 3. The manual security checks, automated

Each check from the security requirements has an automated test, so it runs on every change instead of once before go-live.

| Manual check | Automated test |
|---|---|
| Change an id in the URL to read another business's data (IDOR) | `security.test.ts` → access control; `rls.test.ts` |
| Funder opens a company that hasn't consented | `security.test.ts` → "a funder can't open a company that hasn't shared"; `rls.test.ts` → sharing 'none' |
| Tamper with the role (body, header, query, token) | `security.test.ts` → "a role sent by the client is ignored", "a forged or tampered token is refused"; `rls.test.ts` → users can't change their own role |
| Founder opens funder, adviser or admin screens | `security.test.ts`; e2e `shell.spec.ts` → "each role sees only its own portal" |
| Stored XSS | `security.test.ts` → JSON only; e2e `security.spec.ts` → the script never runs in the browser |
| SQL injection | `security.test.ts` → "SQL in input is treated as data" |
| Malicious uploads (HTML, SVG, program, polyglot, oversized, size mismatch) | `security.test.ts` → malicious uploads; `join.test.ts` → type by signature |
| Signed links expire after 5 minutes; tampered links refused | `security.test.ts` → link expiry |
| Brute-force sign-in; rate limits hold across instances | `auth.test.ts` → lockout after 5; `api.test.ts` → code lockout; `security.test.ts` → shared rate limit |
| Audit log can't be changed, and changes are detected | `rls.test.ts` → append-only; `security.test.ts` → hash chain; `jobs.test.ts` → export |
| No personal data in logs | `security.test.ts` → logs |
| Every table has RLS | `security.test.ts` → RLS coverage |
| Payment proof fraud (wrong amount, reused file, rejected twice) | `payments.test.ts`; e2e `payments.spec.ts` |
| Changed supplier bank details block payments | `payments.test.ts`; e2e `payments.spec.ts` |
| Production refuses unsafe configuration | `api.test.ts`, `security.test.ts` → configuration |

## 4. Results on 25 October 2026

| Run | Result |
|---|---|
| `pnpm test` | shared 46 passed, API 130 passed, web 4 passed |
| `pnpm test:e2e` (phone and desktop, production CSP) | 43 passed, 3 skipped by design |
| Live checks on https://proofpocket-aoty.web.app (`playwright.live.config.ts`) | 4 passed |
| ZAP baseline, web build | FAIL 0, WARN 2 (COEP 90004, SRI 90003; accepted in `asvs-l1.md`), PASS 63 |
| ZAP baseline, API | FAIL 0, WARN 0, PASS 67 |
| ZAP baseline, hosted site | FAIL 0, WARN 3 (COEP, SRI, "retrieved from cache" 10050 for hashed static assets), PASS 61 |
| Audit chain on the hosted database | Intact: 43 rows checked, head hash exported to `audit-exports/2026-10-24.head.json` |
| Semgrep, gitleaks, `pnpm audit` | 0 findings (CI) |

## 5. Still needed from people

An independent penetration test before real founders' data goes in. ZAP baseline is passive; an authenticated active scan and a human tester will find logic flaws that automated tools can't. See `not-implemented.md`.
