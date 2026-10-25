# Retention schedule (draft for the Information Officer)

**Automated** means a job deletes it now (`apps/api/src/jobs.ts` or a storage or database setting). **Proposed** means the period is drafted but the deletion isn't automated, because the period needs approval and no data is old enough yet.

| Data | Keep for | Reason | How it's deleted | Status |
|---|---|---|---|---|
| Unfinished uploads (never completed) | 24 hours | No purpose once abandoned | `jobs.ts` retention: file and row deleted | **Automated** |
| Rate-limit counters | 1 day after the window ends | Security only | `jobs.ts` retention | **Automated** |
| Replaced or deleted stored files (old versions) | 30 days | Recovery after a mistake or attack | Bucket lifecycle rule (`deploy.sh storage`) | **Automated** |
| Database backups | 7 days (daily) | Recovery | Cloud SQL retained backups = 7 | **Automated** |
| Expired payment requests | Kept, marked expired after 7 days | Part of the business record | `jobs.ts` (status only) | **Automated** |
| Books, documents, payment requests and proofs, supplier records | 5 years after the business's last activity | Tax Administration Act s29 (5 years); founders should keep their own export for Companies Act s24 (7 years) | Yearly purge job, after approval | Proposed |
| Account, profile, posts, sharing choices | Until the founder asks for deletion or closes the account, then 30 days | No longer needed | Deletion request handled by admin (`data-subject-requests.md`) | Proposed (manual) |
| Audit log | 5 years | Accountability, disputes | Yearly export, then deletion of rows older than 5 years by the owner (the chain restarts from a recorded head) | Proposed |
| Audit exports in storage | 5 years | Tamper evidence | Bucket lifecycle rule on `audit-exports/` | Proposed |
| Scam sender watch list | Until cleared, then 1 year | Fraud prevention | Yearly purge job | Proposed |
| Application logs | 30 days now; 400 days once `deploy.sh logging` runs | Security investigation | Cloud Logging retention | Automated (30 days) |
| Notification emails in the Gmail sent folder | 90 days | Proof of notification | Gmail filter or manual clean-up | Proposed (manual) |

**To approve:** the Information Officer confirms or changes each "Proposed" period. The yearly purge jobs are then added to `jobs.ts` with tests, as the automated ones were.
