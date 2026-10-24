#!/usr/bin/env python3
"""Creates Firebase sign-in accounts for the hosted example data, with new strong passwords.

Usage: firebase_users.py PROJECT ADMIN_EMAIL OUT_FILE
Uses the signed-in gcloud account (Identity Toolkit admin API). Emails are marked verified so the API links
each sign-in to the matching example user. Passwords are written only to OUT_FILE (git-ignored, mode 600).
"""
import json, os, re, secrets, subprocess, sys, urllib.error, urllib.request

project, admin_email, out = sys.argv[1], sys.argv[2], sys.argv[3]
# Google Cloud project IDs: 6-30 lowercase letters, digits and hyphens. Anything else is refused.
if not re.fullmatch(r"[a-z][a-z0-9-]{4,28}[a-z0-9]", project):
    sys.exit(f"Not a valid project ID: {project!r}")
ACCOUNTS = [
    ("Founder", "Zanele M., Nala Nails & Lashes (Starter)", "zanele@proofpocket.example"),
    ("Founder", "Palesa K., ReKasi Plastics", "palesa@proofpocket.example"),
    ("Founder", "Tumelo R., Mabele AgriLink", "tumelo@proofpocket.example"),
    ("Founder", "Kabelo S., Green Route Waste Services", "kabelo@proofpocket.example"),
    ("Founder", "Thandi N., Mama Tau Catering", "thandi@proofpocket.example"),
    ("Founder", "Sipho D., Khanya Solar Installs", "sipho@proofpocket.example"),
    ("Funder", "Lesedi Youth Fund", "lesedi@proofpocket.example"),
    ("Funder", "Umnotho Seed Partners", "umnotho@proofpocket.example"),
    ("Funder", "Kopano Enterprise Finance", "kopano@proofpocket.example"),
    ("Funder", "Bophelo Community Fund (needs set-up)", "bophelo@proofpocket.example"),
    ("Adviser", "N. Mokoena, Ikhaya Incubation Hub", "n.mokoena@proofpocket.example"),
    ("Adviser", "L. Dube, Ikhaya Incubation Hub", "l.dube@proofpocket.example"),
    ("Adviser", "S. Pillay, Township Futures Trust", "s.pillay@proofpocket.example"),
    ("Adviser", "T. Mahlangu, Township Futures Trust", "t.mahlangu@proofpocket.example"),
    ("Admin", "ProofPocket checker", admin_email),
]
token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
base = f"https://identitytoolkit.googleapis.com/v1/projects/{project}"

def call(path, body):
    # Fixed https host and paths; only the validated project ID varies.
    req = urllib.request.Request(base + path, data=json.dumps(body).encode(), method="POST", headers={
        "Authorization": f"Bearer {token}", "x-goog-user-project": project, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:  # nosemgrep: dynamic-urllib-use-detected
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {"error": json.load(e)}

saved = json.load(open(out)) if os.path.exists(out) else {}
for role, who, email in ACCOUNTS:
    password = saved.get(email, {}).get("password") or secrets.token_urlsafe(12)
    found = call("/accounts:lookup", {"email": [email]}).get("users", [])
    if found:
        r = call("/accounts:update", {"localId": found[0]["localId"], "password": password, "emailVerified": True})
    else:
        r = call("/accounts", {"email": email, "password": password, "emailVerified": True, "displayName": who})
    if "error" in r:
        sys.exit(f"{email}: {r['error']}")
    saved[email] = {"role": role, "who": who, "password": password}
    print(f"{role:8} {email:34} ok")

with open(out, "w") as f:
    json.dump(saved, f, indent=2)
os.chmod(out, 0o600)
print(f"Passwords saved in {out}")
