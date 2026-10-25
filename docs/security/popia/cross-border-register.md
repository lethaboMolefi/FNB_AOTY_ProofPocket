# Cross-border transfers (POPIA s72, draft)

ProofPocket's database, files, API and images are in Google Cloud africa-south1 (Johannesburg). These services may process personal information outside South Africa.

| Service | What leaves South Africa | Where | Safeguard (s72(1)) | Can it stay in South Africa? |
|---|---|---|---|---|
| Firebase Authentication (Identity Platform) | Email address, password hash, sign-in times, IP address | Google's global infrastructure (mainly US) | Google Cloud Data Processing Addendum and standard contractual clauses; the person's consent in the privacy notice | No regional option. The alternative is the API's own sign-in (as `AUTH_MODE=local`), hardened for production |
| Gmail SMTP | Recipient email address and email text (no ID or account numbers are put in emails) | Google global | Google Workspace or Gmail terms; consent | Use a South African email provider |
| Cloud Logging, `_Default` bucket | Request logs: IP address, user id, paths (bodies are never logged) | Global | Google Cloud DPA | **Yes:** `bash infra/deploy.sh logging` routes ProofPocket's logs to an africa-south1 bucket |
| Google Fonts | Visitors' IP address and browser details when the font loads | Google global | Google's terms | Yes: serve the fonts from the app itself (a small change) |
| Cloud Build | Source code only, no personal data | Global build pool | n/a | Use a regional build pool |
| GitHub | Source code and fictional example data only | US | n/a | n/a |

**Information Officer to decide:** whether the consent and Google's contractual safeguards are enough for Firebase Auth and Gmail, or whether to move them (both are possible; see `not-implemented.md`).
