# Go-live gate

ProofPocket can take real founders' data only when every line is ticked and signed. Until then the hosted site is a demo with example data, and a banner on every page says so.

## Engineering (ticked on 25 October 2026)

- [x] Threat model and risk register (`threat-model.md`)
- [x] Secure coding standard and PR checklist (`secure-coding.md`)
- [x] ASVS Level 1 checklist, with gaps listed (`asvs-l1.md`)
- [x] CI green: lint, types, tests, e2e, audit, Semgrep, gitleaks, ZAP, SBOM
- [x] Manual security checks automated (`security-testing.md` §3)
- [x] Hosted in africa-south1; private database with verified TLS
- [x] Backups, deletion protection and bucket versioning
- [x] Tamper-evident audit log with an export outside the database
- [x] Privacy notice, consent version, data export and correction/deletion requests

## Project owner (see `not-implemented.md`)

- [ ] Branch protection on `main`: pull request, one approving review from a code owner, CI checks required
- [ ] `bash infra/deploy.sh iam_hardening` (Editor removed from the default compute account, build account, Data Access logs)
- [ ] `bash infra/deploy.sh logging` and an alert policy that emails the person on call
- [ ] Firebase password policy (≥ 12 characters) and email enumeration protection
- [ ] Jobs scheduled (Cloud Scheduler from another region, or a daily manual run)
- [ ] `firebaseauth.admin` for the API account (admin invites in production)
- [ ] Gmail app password in `proofpocket-smtp-pass`
- [ ] Dedicated Google Cloud project for production (not the shared hackathons-warroom)
- [ ] Demo data removed and `DEMO=no` for the production web build

## People

- [ ] Independent penetration test; high findings fixed and retested
- [ ] POPIA: Information Officer appointed and registered with the Information Regulator
- [ ] POPIA: privacy notice, processing register, retention schedule and cross-border register approved
- [ ] POPIA impact assessment done
- [ ] Incident plan agreed, names filled in, tabletop exercise held
- [ ] Every change since the last review reviewed by a second person

## Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| Information Officer (POPIA) | Obakeng | | |
| Engineering lead | | | |
| Product owner | | | |
