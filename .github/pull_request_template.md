## What changed and why

## Security checklist (docs/security/secure-coding.md)

- [ ] Every new route checks the role on the server and runs in `withContext()` (RLS applies)
- [ ] New tables have RLS switched on and policies (the RLS coverage test passes)
- [ ] Input is validated with a Zod schema from `packages/shared`
- [ ] No ID numbers, account numbers, PINs, codes or file contents in logs, errors or URLs
- [ ] No feature holds or moves money, calls a bank API, or posts through a social media API
- [ ] Business rules live in `packages/shared/src/rules` with tests written first
- [ ] New dependencies were agreed first, are pinned exactly and are at least 24 hours old
- [ ] Changes to personal data are reflected in the privacy notice and the POPIA register (`docs/security/popia/`)
- [ ] Tests added or updated; `pnpm lint && pnpm typecheck && pnpm test` pass

## How I tested it
