# Incident and breach response plan (draft)

**Status:** draft for the team and the Information Officer to agree and rehearse. Names in [brackets] must be filled in.

## Roles

| Role | Who | Does |
|---|---|---|
| Incident lead | [name, phone] | Decides severity, runs the response, keeps the timeline |
| Engineer on call | [name, phone] | Contains the problem and fixes it, keeps evidence |
| Information Officer | Obakeng [to confirm] | Decides on POPIA notifications; talks to the Information Regulator |
| Communications | [name] | Writes to affected founders, funders and incubators |

## Severity

| Level | Examples | Start within |
|---|---|---|
| **1 Critical** | Personal data or documents exposed; payment details changed by someone else; audit chain broken | 1 hour |
| **2 High** | A security control is down (sign-in checks, rate limits); a dependency with a known exploit is in production | 4 hours |
| **3 Medium** | A vulnerability reported but not exploited; suspicious activity on one account | 2 working days |
| **4 Low** | Hardening suggestions | Next sprint |

## How we find out

- Integrity alerts from `proofpocket-jobs` (audit chain broken, a document changed after it was checked). Log entries with `"alert":"integrity"`, alerting once `deploy.sh logging` and the alert policy are set up.
- Fraud flags: "Not received" twice, reused proofs, scam reports (admin → Flagged payments, Reports).
- Reports through GitHub private vulnerability reporting (`SECURITY.md`).
- Budget alerts (unusual traffic), Cloud Run error rates, the weekly ZAP scan.

## Steps

1. **Record.** Open a private incident note: time, who reported it, what is known. Keep every timestamp from here on.
2. **Contain.**
   - Account takeover: an admin resets the user's Google Authenticator, disables the account in Firebase (Authentication → Users → Disable), and revokes refresh tokens.
   - Leaked secret: add a new version in Secret Manager, redeploy (`deploy.sh api`), disable the old version. For `proofpocket-account-key`, re-encrypt stored values before disabling the old key.
   - Bad deploy: roll back to the previous Cloud Run revision (`gcloud run services update-traffic proofpocket-api --to-revisions=<previous>=100 --region africa-south1`).
   - Need to stop everything: scale the API to zero (`--max-instances 0`) and put a notice on the hosted site.
3. **Preserve evidence.** Export the relevant logs and `audit_log` rows. Run `select * from audit_log_verify()` and compare with the latest `audit-exports/*.head.json`. Don't delete anything.
4. **Assess.** Whose data, which fields, how many people, since when. Is there a "reasonable ground to believe" personal information was accessed by an unauthorised person (POPIA s22)?
5. **Notify** (Information Officer decides):
   - **Information Regulator:** as soon as reasonably possible, target **72 hours**, using the Regulator's security compromise notification form (inforegulator.org.za).
   - **Affected people:** in writing (email to their sign-in address and a message in ProofPocket). Say what happened, what data, what we've done, and what they should do (for example, check their bank account and tell their clients the correct payment details).
   - **Funders and incubators**, if their portal data or decisions are affected.
6. **Fix and recover.** Fix the cause, add a regression test, and restore from backup if needed (Cloud SQL point-in-time or daily backup; bucket object versions are kept for 30 days).
7. **Review** within 5 working days: timeline, root cause, what worked, what to change. Update `threat-model.md` and this plan.

## Rehearsal

Run a 1-hour tabletop exercise before go-live (scenario: "a founder says their payout account was changed and a client paid the wrong account"), then every 6 months.
