# Record of processing (POPIA s17, draft)

**Responsible party:** ProofPocket (Team KamosoByte)
**Information Officer:** [to be appointed; Obakeng proposed]. Must be registered with the Information Regulator before go-live.
**Operator (processor):** Google Cloud and Firebase (Google Ireland / Google LLC), under Google's Cloud Data Processing Addendum.

| Who the data is about | What | Why | Lawful basis (s11) | Where | Who sees it | Kept for |
|---|---|---|---|---|---|---|
| Founders | Name, email, sign-in records | Account, two-step sign-in | Contract | Firebase Auth (global), Cloud SQL | The founder; admin | While the account is open, then 5 years |
| Founders | Owner ID copy, proof of address | Verification | Consent, contract | Private bucket (africa-south1) | Checker (adviser or admin); never funders | 5 years after last activity |
| Businesses (and their owners) | Company registration, bank letter, tax and other documents | Verification, readiness | Consent, contract | Private bucket | Checker, adviser; funders see status only | 5 years after last activity |
| Businesses | Books, stock, suppliers, cash flow | Bookkeeping, readiness | Contract | Cloud SQL | Founder, adviser; funders per sharing choice | 5 years (Tax Administration Act s29) |
| Founders | Payment details (bank, account number encrypted) | Showing clients where to pay | Contract | Cloud SQL | Founder; clients with a payment link (last 4 digits shown) | Until replaced, then 5 years in history |
| Founders' clients (payers) | Name given on the request, proof of payment file, reference | Confirming a payment | Legitimate interest (founder and client) | Cloud SQL, private bucket | The founder; admin if flagged | 5 years |
| Suppliers | Name, bank details and changes | Fraud protection on payments | Legitimate interest | Cloud SQL | Founder | 5 years |
| Senders of suspicious messages | Phone number or email, report count | Warning other founders about scams | Legitimate interest (fraud prevention) | Cloud SQL (`sender_watchlist`) | Founders checking a message see a warning only; admin | Until cleared, then 1 year |
| Funders, advisers, admins | Name, email, organisation, actions | Running the portals; accountability | Contract, legitimate interest | Firebase Auth, Cloud SQL, audit log | Admin | While active, then 5 years |
| Website visitors | IP address in logs; rate-limit counters | Security, abuse prevention | Legitimate interest | Cloud Logging, Cloud SQL | Engineering | Logs 30 days (400 after `logging`); counters 1 day |

**Special personal information (s26):** none is collected on purpose. ID copies can show race or gender, which is why they are seen only by the checker and never shared with funders.

**Children (s34):** ProofPocket is for founders aged 18 and over. [Add an age confirmation at joining if the Information Officer requires it.]

**Direct marketing (s69):** none. Posts are shared by founders from their own accounts.
