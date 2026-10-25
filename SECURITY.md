# Security policy

ProofPocket keeps founders' business records, documents and payment details. We take reports seriously.

## Reporting a vulnerability

- Use **GitHub → Security → Report a vulnerability** (private vulnerability reporting) on this repository.
  Please don't open a public issue for anything that could put someone's data or money at risk.
- Tell us what you found, how to reproduce it, and what an attacker could do with it.
- Test only with the example accounts on the demo site. Never use real people's data, never try to read
  another business's records beyond proving the problem, and stop as soon as you've shown it.
- Don't run denial-of-service, spam or social-engineering tests.

We aim to acknowledge reports within **2 working days** and to fix high-risk issues within **7 days**
(see `docs/security/incident-response.md` for how incidents are handled and who is told).

## Supported versions

Only the current `main` branch and the hosted demo at https://proofpocket-aoty.web.app are supported.

## How we build securely

See `docs/security/` for the threat model, the ASVS Level 1 checklist, the requirements matrix and the
automated checks that run on every change (`.github/workflows/ci.yml`).
