# What I couldn't implement, and how to finish it

Everything that could be done in code, configuration, CI and documents is done and deployed (see `requirements-matrix.md`). What's left falls into three groups:

- **A. Needs you, the project owner:** one command or one settings page each. These change shared Google Cloud or GitHub settings, so they need your permission and your accounts.
- **B. Needs a decision first:** the code can be written as soon as someone decides.
- **C. Only people can do it:** sign-off, independent testing, review.

The go-live gate (`go-live-checklist.md`) lists every item. Until they're done, the hosted site stays a demo, with a banner on every page.

---

## A. Needs you, the project owner

### A1. Branch protection and a second reviewer on `main`
**Why I couldn't:** there's no GitHub admin token in this environment, and separation of duties needs a second person.
**Do this:** GitHub → the repository → Settings → Branches → Add rule for `main`:
- Require a pull request before merging, with **1 approval**.
- Require review from Code Owners (`.github/CODEOWNERS` is in place).
- Dismiss stale approvals when new commits are pushed.
- Require status checks: `checks`, `semgrep`, `gitleaks`, `zap`, `sbom`.
- Require branches to be up to date; block force pushes and deletion.
- Optionally, include administrators.

Then add a second team member as a collaborator and, if wanted, as a code owner.

### A2. GitHub security features
**Do this:** Settings → Code security:
- Turn on **Private vulnerability reporting** (`SECURITY.md` points to it).
- Turn on **Dependabot alerts** and **Dependabot security updates** (`.github/dependabot.yml` is already there).
- Turn on **Secret scanning** and **Push protection**.

### A3. Least-privilege Google Cloud accounts and Data Access logs
**Why I couldn't:** these change IAM on the shared `hackathons-warroom` project, and the permission checker blocks me from making IAM changes.
**Do this:**
```
bash infra/deploy.sh iam_hardening
```
This:
- removes **Editor** from the default compute service account;
- creates `proofpocket-build` for Cloud Build;
- turns on Data Access audit logs for Secret Manager, Cloud SQL and Cloud Storage.

**First check** that nothing else in `hackathons-warroom` runs as the default compute account (Cloud Run → each service → Security tab). From then on, build with:
```
BUILD_SA=proofpocket-build@hackathons-warroom.iam.gserviceaccount.com bash infra/deploy.sh image
```

### A4. Admin invites in production (`firebaseauth.admin`)
**Why I couldn't:** this is also an IAM grant.
**Do this:**
```
bash infra/deploy.sh identity
```

### A5. Logs kept in Johannesburg, and integrity alerts
**Why I couldn't:** it changes project logging, and the alert needs the email address of whoever is on call.
**Do this:**
1. Run `bash infra/deploy.sh logging`. This creates an africa-south1 log bucket (400 days), a sink for ProofPocket's logs, and the `proofpocket-integrity` metric.
2. In Monitoring → Alerting → Create policy, use the metric `logging.googleapis.com/user/proofpocket-integrity`, with any value above 0. Set the notification channel to the on-call email.

### A6. Firebase password policy and email enumeration protection
**Why I couldn't:** this is a project-wide Firebase setting. ProofPocket already asks for at least 12 characters in its own forms, but people sign up with Firebase directly, so Firebase must enforce it too.
**Do this:** Firebase console → Authentication → Settings:
- **Password policy:** require, minimum length 12.
- **User actions:** turn on **Email enumeration protection**.

### A7. Gmail app password
**Why I couldn't:** a password must never pass through chat.
**Do this:** create an app password for the sender Gmail account (Google Account → Security → App passwords), then:
```
printf '%s' 'THE-APP-PASSWORD' | gcloud secrets versions add proofpocket-smtp-pass --data-file=- --project hackathons-warroom
bash infra/deploy.sh api
```

### A8. Scheduling the daily jobs
**Why I couldn't:** Cloud Scheduler isn't available in africa-south1, and the brief says to stop and ask when a service isn't. The job does a lot every day: expiry, the audit-chain check and export, and retention. Until you choose, run it by hand:
```
gcloud run jobs execute proofpocket-jobs --region africa-south1 --project hackathons-warroom
```
**Options:**
1. Put Cloud Scheduler in another region (for example europe-west1) to trigger the africa-south1 job. Only the trigger is outside South Africa; no personal data leaves.
2. Use a GitHub Actions schedule that runs the `gcloud` command above. This needs a workload identity federation set-up.
3. Keep running it by hand every day.

### A9. Container vulnerability scanning
**Why I couldn't:** enabling it is billed per image.
**Do this:**
```
gcloud services enable containerscanning.googleapis.com --project hackathons-warroom
```
Results then show in Artifact Registry → proofpocket → each image.

### A10. A dedicated production project
**Why I couldn't:** a new project needs Google to raise your billing quota (it was refused earlier).
**Do this:**
1. Ask for the quota increase.
2. Run `PROJECT=<new-project> bash infra/deploy.sh all`, then `iam_hardening` and `logging`.
3. Build the web with `DEMO=no SEED_EXAMPLE_DATA=no` so it has no example data and no demo banner.

### A11. Optional: customer-managed encryption keys (CMEK)
This is only needed if a funder or regulator asks for it. It means:
- a Cloud KMS key ring in africa-south1;
- a new Cloud SQL instance and bucket created with that key (they can't be switched later).

Do it together with A10.

---

## B. Needs a decision first (I can build it once decided)

| # | Decision | Who decides | What I'd build then |
|---|---|---|---|
| B1 | Approve the retention periods in `popia/retention-schedule.md` (the "Proposed" rows) | Information Officer | Yearly purge jobs in `jobs.ts` with tests: 5-year business records, audit log, watch list |
| B2 | How deletion requests are carried out (what's deleted at once, what's kept for 5 years) | Information Officer | An admin "Carry out deletion" action, in place of the manual database step in `popia/data-subject-requests.md` |
| B3 | Whether Firebase Auth and Gmail may process emails outside South Africa (`popia/cross-border-register.md`) | Information Officer | Either nothing, or move sign-in to the API (as local mode, hardened) and email to a South African provider |
| B4 | Whether founders must confirm they are 18 or older | Information Officer | An age confirmation at joining |
| B5 | Accept the ZAP warnings that remain: COEP (it would break Firebase sign-in pop-ups) and "retrieved from cache" (hashed static files) | Engineering lead | Nothing, or remove the pop-up sign-in to allow COEP |

---

## C. Only people can do it

| # | What | Why it can't be automated |
|---|---|---|
| C1 | **Peer review** of every change by a second team member | Separation of duties: the author, human or AI, can't approve their own work. Branch protection (A1) enforces it |
| C2 | **POPIA sign-off by Obakeng**, as Information Officer | A legal accountability that a named person carries (s55) |
| C3 | **Register the Information Officer** with the Information Regulator | Done by the responsible party on the Regulator's portal |
| C4 | **POPIA impact assessment**, and legal review of the privacy notice | Needs judgement about risk to people and legal advice |
| C5 | **Independent penetration test** (authenticated, active), with fixes retested | Must be independent of the people who built it. ZAP baseline is passive only |
| C6 | **Agree the incident plan**: fill in names and phone numbers, and hold the tabletop exercise | People and their availability |
| C7 | **Security awareness** for the team (phishing, handling founders' documents, the admin checker's duties) | Training people |
| C8 | **Go-live sign-off** in `go-live-checklist.md` | Accountable people sign |

---

## What changed in this round

**Database and API**
- The audit log is hash-chained, checked every day, and exported with its latest hash.
- Rate limits are counted in Postgres, so they hold across instances.
- Database connections verify the server certificate.

**Privacy (POPIA)**
- The privacy notice has a recorded version, and founders are asked to agree again when it changes.
- Founders can download their data and ask for corrections or deletion.
- Retention jobs delete what doesn't need keeping.
- The fonts are self-hosted, so visitors' IP addresses no longer go to Google.

**Hosting and browser**
- Bucket versioning is on.
- The hosted site shows a demo banner.
- Signing out now clears the founder's cached data on the phone; this was a bug.
- Signing out warns about entries that haven't been sent yet.

**Checks and tests**
- ZAP scans run in CI and weekly against the live site.
- An SBOM is produced on every build.
- Dependabot, CODEOWNERS, `SECURITY.md` and a security checklist in pull requests are in place.
- A security regression suite runs on every change.
- The minimum password length is now 12.
