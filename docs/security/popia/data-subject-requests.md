# Handling access, correction and deletion requests (POPIA s23–25)

## How founders ask

- **Access:** Privacy & sharing → Your data → **Download my data**. They get a JSON file at once with their account, company, documents (not the files themselves), books, stock, suppliers, payments, messages, profile, posts, applications and offers, and the timeline. Storage paths and encrypted values are left out. The download is recorded in the audit log (`privacy.exported`).
- **Correction or deletion:** the same panel → **Ask ProofPocket to** → Correct something or Delete my data. This creates a report of type *data request* in admin → Reports, adds a line to the founder's timeline, and records `privacy.correction_requested` or `privacy.deletion_requested` in the audit log.
- People who aren't founders (clients, suppliers, reported senders) write to the Information Officer. Check who they are before acting.

## What admin does (within 30 days)

1. Open admin → Reports and find the *data request*. The request came from the signed-in founder, so their identity is already confirmed; for anyone else, confirm it first.
2. **Correction:** most details the founder can change themselves (Business settings, Profile, Payment details). Explain how, or make the change and note it. Never change verified documents; ask for a new upload instead.
3. **Deletion:**
   - Tell the founder what has to be kept by law (books, documents and payments for 5 years; the audit log) and what will be deleted now (profile, posts, sharing, incubator membership, payment details no longer needed).
   - Set sharing to "Nothing" and remove the business from the directory straight away.
   - Delete what isn't needed. This is a manual step with the database owner role, recorded in the audit log, until a deletion job is approved (`not-implemented.md`).
   - Disable the founder's sign-in in Firebase once they confirm.
4. Resolve the report with a note of what was done, and email the founder the outcome (resolving a report doesn't message them by itself).
5. If refusing any part, give the reason and the right to complain to the Information Regulator.
