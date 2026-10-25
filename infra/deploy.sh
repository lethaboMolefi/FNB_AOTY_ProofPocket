#!/usr/bin/env bash
# ProofPocket on Google Cloud (africa-south1, Johannesburg). Documented gcloud steps, safe to re-run.
#
#   bash infra/deploy.sh <step>      run one step
#   bash infra/deploy.sh all         run everything in order
#
# Steps: network, database, storage, secrets, identity, registry, image, bootstrap, api, jobs, firebase, web, users, budget, smoke
# Owner-approved extras (not in "all"; see docs/security/not-implemented.md): iam_hardening, logging
# Needs: gcloud and firebase CLIs signed in as a project owner, Node 26 + pnpm 12, python3.
set -euo pipefail

PROJECT="${PROJECT:-hackathons-warroom}"
REGION="${REGION:-africa-south1}"
SITE="${SITE:-proofpocket-aoty}"                         # Firebase Hosting site → https://$SITE.web.app
WEB_ORIGIN="https://${SITE}.web.app"
# Google sign-in returns to https://$AUTH_DOMAIN/__/auth/handler, which must be an approved redirect URI on the
# project's Google OAuth client (Cloud Console > APIs & Services > Credentials). The site's own handler is approved.
AUTH_DOMAIN="${AUTH_DOMAIN:-${SITE}.firebaseapp.com}"
# Firebase Hosting can't route to Cloud Run in africa-south1, so the web app calls the API here directly.
API_URL="https://${SERVICE:-proofpocket-api}-$(gcloud projects describe "$PROJECT" --format='value(projectNumber)' | cat).${REGION}.run.app"
NETWORK=proofpocket-vpc
SUBNET=proofpocket-run                                   # Cloud Run Direct VPC egress
SUBNET_RANGE=10.80.0.0/24
PSA_RANGE=proofpocket-psa                                # Private Service Access range for Cloud SQL
SQL=proofpocket-db
DB=proofpocket
BUCKET="${PROJECT}-proofpocket-files"
SA_NAME=proofpocket-api
SA="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
REPO=proofpocket
SERVICE=proofpocket-api
MAIL_USER="${MAIL_USER:-pegphina1@gmail.com}"           # Gmail account that sends email (its app password is proofpocket-smtp-pass)
HERE="$(cd "$(dirname "$0")" && pwd)"
# Working files live here, not in /tmp: a snap-installed gcloud has its own private /tmp and can't see ours.
WORK="$HERE/.work"; mkdir -p "$WORK"
SYSTEM="$HERE/../system"
TAG="${TAG:-$(git -C "$HERE/.." rev-parse --short HEAD)}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/api:${TAG}"

# The Cloud SQL server CA (public, not a secret): connections verify the server certificate (verify-ca).
db_ca() { g sql instances describe "$SQL" --format='value(serverCaCert.cert)' | base64 -w0; }

# Output always goes through pipes: snap-installed gcloud fails (exit 120) when writing straight into a file.
g() { gcloud --project "$PROJECT" --quiet "$@" 2> >(cat >&2) | cat; }
exists() { "$@" >/dev/null 2>&1; }
secret_set() { # name value: create the secret or add a new version
  if exists g secrets describe "$1"; then printf '%s' "$2" | g secrets versions add "$1" --data-file=- >/dev/null
  else printf '%s' "$2" | g secrets create "$1" --replication-policy=user-managed --locations="$REGION" --data-file=- >/dev/null; fi
}
rand() { python3 -c "import secrets,base64;print(base64.b64encode(secrets.token_bytes(32)).decode())"; }
pw() { python3 -c "import secrets;print(secrets.token_urlsafe(24))"; }

step_network() {
  exists g compute networks describe "$NETWORK" || g compute networks create "$NETWORK" --subnet-mode=custom
  exists g compute networks subnets describe "$SUBNET" --region "$REGION" ||
    g compute networks subnets create "$SUBNET" --network "$NETWORK" --region "$REGION" --range "$SUBNET_RANGE" --enable-private-ip-google-access
  exists g compute addresses describe "$PSA_RANGE" --global ||
    g compute addresses create "$PSA_RANGE" --global --purpose=VPC_PEERING --prefix-length=20 --network "$NETWORK"
  g services vpc-peerings connect --service=servicenetworking.googleapis.com --ranges="$PSA_RANGE" --network="$NETWORK" 2>/dev/null ||
    g services vpc-peerings update --service=servicenetworking.googleapis.com --ranges="$PSA_RANGE" --network="$NETWORK" --force
}

step_database() {
  # Private IP only (no public IP), backups, deletion protection, encrypted connections only.
  exists g sql instances describe "$SQL" || g sql instances create "$SQL" \
    --database-version=POSTGRES_18 --edition=ENTERPRISE --tier=db-f1-micro --region "$REGION" \
    --network="projects/${PROJECT}/global/networks/${NETWORK}" --no-assign-ip \
    --ssl-mode=ENCRYPTED_ONLY --backup-start-time=01:00 --retained-backups-count=7 \
    --storage-size=10 --storage-auto-increase --deletion-protection
  exists g sql databases describe "$DB" --instance "$SQL" || g sql databases create "$DB" --instance "$SQL"
  # The owner runs migrations; the restricted app role (no superuser rights, RLS applies) is created by the
  # migrations themselves and given its password by the bootstrap job.
  # Placeholders may exist so permissions could be granted early; fill them in once.
  if [ "$(g secrets versions access latest --secret proofpocket-db-owner-url 2>/dev/null || echo pending)" = "pending" ]; then
    local owner_pw app_pw ip
    owner_pw=$(pw); app_pw=$(pw)
    ip=$(g sql instances describe "$SQL" --format='value(ipAddresses[0].ipAddress)')
    exists g sql users describe proofpocket_owner --instance "$SQL" && g sql users set-password proofpocket_owner --instance "$SQL" --password "$owner_pw" ||
      g sql users create proofpocket_owner --instance "$SQL" --password "$owner_pw"
    secret_set proofpocket-db-owner-url "postgres://proofpocket_owner:${owner_pw}@${ip}:5432/${DB}?sslmode=no-verify"
    secret_set proofpocket-db-app-url "postgres://proofpocket_app:${app_pw}@${ip}:5432/${DB}?sslmode=no-verify"
    secret_set proofpocket-db-app-password "$app_pw"
  fi
}

step_storage() {
  exists g storage buckets describe "gs://$BUCKET" || g storage buckets create "gs://$BUCKET" --location "$REGION" \
    --uniform-bucket-level-access --public-access-prevention
  cat > "$WORK/cors.json" <<EOF
[{"origin": ["${WEB_ORIGIN}", "https://${SITE}.firebaseapp.com"], "method": ["PUT", "GET"],
  "responseHeader": ["Content-Type", "x-goog-content-length-range"], "maxAgeSeconds": 3600}]
EOF
  g storage buckets update "gs://$BUCKET" --cors-file="$WORK/cors.json"
  # Versioning keeps an overwritten or deleted file for 30 days (recovery after a mistake or an attack);
  # after that it's gone, so deletions for POPIA still complete.
  echo '{"rule": [{"action": {"type": "Delete"}, "condition": {"isLive": false, "daysSinceNoncurrentTime": 30}}]}' > "$WORK/lifecycle.json"
  g storage buckets update "gs://$BUCKET" --versioning --lifecycle-file="$WORK/lifecycle.json"
}

step_secrets() {
  exists g secrets describe proofpocket-account-key || secret_set proofpocket-account-key "$(rand)"
  exists g secrets describe proofpocket-otp-secret || secret_set proofpocket-otp-secret "$(rand)"
  # Replaced by the Gmail app password (see infra/README.md). Until then emails fail and are logged, nothing else breaks.
  exists g secrets describe proofpocket-smtp-pass || secret_set proofpocket-smtp-pass "not-set-yet"
}

step_identity() {
  exists g iam service-accounts describe "$SA" || g iam service-accounts create "$SA_NAME" --display-name "ProofPocket API"
  for s in proofpocket-db-owner-url proofpocket-db-app-url proofpocket-db-app-password proofpocket-account-key proofpocket-otp-secret proofpocket-smtp-pass; do
    g secrets add-iam-policy-binding "$s" --member "serviceAccount:$SA" --role roles/secretmanager.secretAccessor >/dev/null
  done
  g storage buckets add-iam-policy-binding "gs://$BUCKET" --member "serviceAccount:$SA" --role roles/storage.objectAdmin >/dev/null
  # Signs V4 upload/download URLs without a key file (IAM signBlob on itself).
  g iam service-accounts add-iam-policy-binding "$SA" --member "serviceAccount:$SA" --role roles/iam.serviceAccountTokenCreator >/dev/null
  # Checks Firebase sign-ins haven't been revoked, and creates sign-ins for people the admin invites.
  g projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA" --role roles/firebaseauth.admin --condition=None >/dev/null
}

step_registry() {
  exists g artifacts repositories describe "$REPO" --location "$REGION" ||
    g artifacts repositories create "$REPO" --repository-format=docker --location "$REGION" --description "ProofPocket images"
}

step_image() {
  # Build from the committed code only (git archive): no local files or secrets can reach Cloud Build,
  # and the image always matches its commit tag.
  [ -z "$(git -C "$HERE/.." status --porcelain system)" ] || { echo "Commit your changes to system/ first."; exit 1; }
  local stage; stage=$(mktemp -d "$WORK/build.XXXXXX")
  git -C "$HERE/.." archive --format=tar "$TAG" system | tar -x -C "$stage"
  # BUILD_SA (from iam_hardening) builds with a least-privilege account instead of the default one.
  g builds submit "$stage/system" --tag "$IMAGE" ${BUILD_SA:+--service-account "projects/${PROJECT}/serviceAccounts/${BUILD_SA}" --default-buckets-behavior regional-user-owned-bucket}
  rm -rf "$stage"
}

step_bootstrap() {
  # One-off job inside the VPC: migrations, the app role's password, and the example data (only into an empty database).
  local args=(--image "$IMAGE" --region "$REGION" --service-account "$SA" --network "$NETWORK" --subnet "$SUBNET" --vpc-egress private-ranges-only
    --set-secrets "DATABASE_OWNER_URL=proofpocket-db-owner-url:latest,APP_DB_PASSWORD=proofpocket-db-app-password:latest,ACCOUNT_NUMBER_KEY=proofpocket-account-key:latest"
    --set-env-vars "SEED_EXAMPLE_DATA=${SEED_EXAMPLE_DATA:-no},SEED_ADMIN_EMAIL=${MAIL_USER},DATABASE_CA_CERT_B64=$(db_ca)" --command node --args dist/bootstrap.js --max-retries 0 --task-timeout 600)
  if exists g run jobs describe proofpocket-bootstrap --region "$REGION"; then g run jobs update proofpocket-bootstrap "${args[@]}"
  else g run jobs create proofpocket-bootstrap "${args[@]}"; fi
  g run jobs execute proofpocket-bootstrap --region "$REGION" --wait
}

step_api() {
  g run deploy "$SERVICE" --image "$IMAGE" --region "$REGION" --service-account "$SA" \
    --network "$NETWORK" --subnet "$SUBNET" --vpc-egress private-ranges-only \
    --allow-unauthenticated --min-instances 0 --max-instances 4 --memory 512Mi --cpu 1 --concurrency 40 \
    --set-env-vars "^|^NODE_ENV=production|TRUST_PROXY_HOPS=1|AUTH_MODE=firebase|FIREBASE_PROJECT_ID=${PROJECT}|MAIL_MODE=smtp|SMTP_USER=${MAIL_USER}|MAIL_FROM=ProofPocket <${MAIL_USER}>|STORAGE_MODE=gcs|GCS_BUCKET=${BUCKET}|WEB_ORIGIN=${WEB_ORIGIN},https://${SITE}.firebaseapp.com|PUBLIC_WEB_URL=${WEB_ORIGIN}|RATE_LIMIT_STORE=postgres|DATABASE_CA_CERT_B64=$(db_ca)" \
    --set-secrets "DATABASE_URL=proofpocket-db-app-url:latest,ACCOUNT_NUMBER_KEY=proofpocket-account-key:latest,OTP_SECRET=proofpocket-otp-secret:latest,SMTP_PASS=proofpocket-smtp-pass:latest"
}

step_jobs() {
  # Expiry and fingerprint checks (src/jobs.ts), as a Cloud Run Job in africa-south1. Start it by hand with:
  #   gcloud run jobs execute proofpocket-jobs --region africa-south1 [--args=dist/jobs.js,--rehash]
  # Cloud Scheduler isn't available in africa-south1; see the README before scheduling it from another region.
  local args=(--image "$IMAGE" --region "$REGION" --service-account "$SA" --network "$NETWORK" --subnet "$SUBNET" --vpc-egress private-ranges-only
    --set-secrets "DATABASE_OWNER_URL=proofpocket-db-owner-url:latest"
    --set-env-vars "STORAGE_MODE=gcs,GCS_BUCKET=${BUCKET},DATABASE_CA_CERT_B64=$(db_ca)" --command node --args dist/jobs.js --max-retries 1 --task-timeout 1800)
  if exists g run jobs describe proofpocket-jobs --region "$REGION"; then g run jobs update proofpocket-jobs "${args[@]}"
  else g run jobs create proofpocket-jobs "${args[@]}"; fi
}

step_firebase() {
  firebase projects:list 2>/dev/null | grep -q " $PROJECT " || firebase projects:addfirebase "$PROJECT"
  firebase hosting:sites:list --project "$PROJECT" 2>/dev/null | grep -q " $SITE " || firebase hosting:sites:create "$SITE" --project "$PROJECT"
  # Firebase Authentication (Identity Platform; email + password is free up to ~50k monthly users, no SMS used).
  local token; token=$(gcloud auth print-access-token | cat)
  curl -s -X POST "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT}/identityPlatform:initializeAuth" \
    -H "Authorization: Bearer $token" -H "x-goog-user-project: ${PROJECT}" -H "Content-Type: application/json" -d '{}' >/dev/null
  curl -sf -X PATCH "https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired,authorizedDomains" \
    -H "Authorization: Bearer $token" -H "x-goog-user-project: ${PROJECT}" -H "Content-Type: application/json" \
    -d "{\"signIn\":{\"email\":{\"enabled\":true,\"passwordRequired\":true}},\"authorizedDomains\":[\"localhost\",\"${SITE}.web.app\",\"${SITE}.firebaseapp.com\",\"${PROJECT}.firebaseapp.com\"]}" >/dev/null
  firebase apps:list WEB --project "$PROJECT" 2>/dev/null | grep -q "ProofPocket web" || firebase apps:create WEB "ProofPocket web" --project "$PROJECT"
}

step_web() {
  # The Firebase web config is public by design (it identifies the project; access is controlled by the API and RLS).
  local app_id cfg
  app_id=$(firebase apps:list WEB --project "$PROJECT" --json | python3 -c "import json,sys;print([a['appId'] for a in json.load(sys.stdin)['result'] if a['displayName']=='ProofPocket web'][0])")
  cfg=$(firebase apps:sdkconfig WEB "$app_id" --project "$PROJECT" --json | python3 -c "import json,sys;r=json.load(sys.stdin)['result'];c=r.get('sdkConfig',r);print(c['apiKey'],c['authDomain'],c['projectId'],c['appId'])")
  read -r key domain pid aid <<<"$cfg"
  (cd "$SYSTEM/apps/web" && VITE_API_BASE="$API_URL" VITE_AUTH_MODE=firebase VITE_FIREBASE_API_KEY="$key" VITE_FIREBASE_AUTH_DOMAIN="${AUTH_DOMAIN}" \
    VITE_FIREBASE_PROJECT_ID="$pid" VITE_FIREBASE_APP_ID="$aid" VITE_DEMO="${DEMO:-no}" pnpm build)
  (cd "$SYSTEM" && firebase deploy --only "hosting:${SITE}" --project "$PROJECT")
  : "$domain"
}

step_users() {
  # Firebase sign-in accounts for the example data, with new strong passwords (written to infra/.hosted-credentials.json).
  python3 "$HERE/firebase_users.py" "$PROJECT" "$MAIL_USER" "$HERE/.hosted-credentials.json"
}

step_budget() {
  local acct
  acct=$(g billing projects describe "$PROJECT" --format='value(billingAccountName)' | sed 's#billingAccounts/##')
  g billing budgets list --billing-account "$acct" --format='value(displayName)' | grep -q "ProofPocket" ||
    g billing budgets create --billing-account "$acct" --display-name "ProofPocket (whole hackathons-warroom project)" \
      --budget-amount=40USD --filter-projects="projects/${PROJECT}" \
      --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0
}

step_smoke() {
  curl -sf "${API_URL}/api/v1/health" && echo
  curl -sI -X OPTIONS "${API_URL}/api/v1/me" -H "Origin: ${WEB_ORIGIN}" -H "Access-Control-Request-Method: GET" | grep -i "^access-control-allow-origin"
  curl -sfI "${WEB_ORIGIN}/" | grep -iE "^(strict-transport-security|content-security-policy|x-content-type-options):" || true
  curl -sf "${WEB_ORIGIN}/manifest.webmanifest" | python3 -c "import json,sys;m=json.load(sys.stdin);print('manifest:',m['name'],m['display'])"
}

step_iam_hardening() {
  # Least privilege (STRIDE: elevation of privilege). Changes project IAM, so the project owner runs it.
  local num compute cb
  num=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)' | cat)
  compute="${num}-compute@developer.gserviceaccount.com"
  # 1. The default compute account loses Editor on the whole project.
  g projects remove-iam-policy-binding "$PROJECT" --member "serviceAccount:$compute" --role roles/editor --condition=None >/dev/null || true
  # 2. Cloud Build gets its own account that can only push ProofPocket images and write build logs.
  cb="proofpocket-build@${PROJECT}.iam.gserviceaccount.com"
  exists g iam service-accounts describe "$cb" || g iam service-accounts create proofpocket-build --display-name "ProofPocket image builds"
  g artifacts repositories add-iam-policy-binding "$REPO" --location "$REGION" --member "serviceAccount:$cb" --role roles/artifactregistry.writer >/dev/null
  g projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$cb" --role roles/logging.logWriter --condition=None >/dev/null
  g projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$cb" --role roles/storage.objectUser --condition=None >/dev/null
  echo "Build images with: BUILD_SA=$cb bash infra/deploy.sh image"
  # 3. Data Access audit logs for Secret Manager, Cloud SQL and Cloud Storage (who read which secret or file).
  g projects get-iam-policy "$PROJECT" --format=json > "$WORK/policy.json"
  python3 -c '
import json, sys
p = json.load(open(sys.argv[1]))
have = {c["service"] for c in p.get("auditConfigs", [])}
for svc in ["secretmanager.googleapis.com", "cloudsql.googleapis.com", "storage.googleapis.com"]:
    if svc not in have:
        p.setdefault("auditConfigs", []).append({"service": svc, "auditLogConfigs": [{"logType": t} for t in ("ADMIN_READ", "DATA_READ", "DATA_WRITE")]})
json.dump(p, open(sys.argv[1], "w"))' "$WORK/policy.json"
  g projects set-iam-policy "$PROJECT" "$WORK/policy.json" >/dev/null
}

step_logging() {
  # Keeps ProofPocket's logs in Johannesburg for 400 days, and counts integrity alerts from the jobs
  # (audit chain broken or a document changed) so Monitoring can email whoever is on call.
  exists g logging buckets describe proofpocket-logs --location "$REGION" ||
    g logging buckets create proofpocket-logs --location "$REGION" --retention-days 400 --description "ProofPocket logs (africa-south1)"
  local filter='resource.type=("cloud_run_revision" OR "cloud_run_job") AND (resource.labels.service_name="proofpocket-api" OR resource.labels.job_name=("proofpocket-jobs" OR "proofpocket-bootstrap"))'
  exists g logging sinks describe proofpocket-logs ||
    g logging sinks create proofpocket-logs "logging.googleapis.com/projects/${PROJECT}/locations/${REGION}/buckets/proofpocket-logs" --log-filter="$filter"
  exists g logging metrics describe proofpocket-integrity ||
    g logging metrics create proofpocket-integrity --description "Integrity alerts from proofpocket-jobs" \
      --log-filter='resource.type="cloud_run_job" AND resource.labels.job_name="proofpocket-jobs" AND severity>=ERROR AND textPayload:"integrity"'
  echo "Then add an alert policy on logging.googleapis.com/user/proofpocket-integrity (Monitoring > Alerting) that emails the person on call."
}

case "${1:-}" in
  all) for s in network database storage secrets identity registry image bootstrap api jobs firebase web users budget smoke; do echo "== $s"; "step_$s"; done ;;
  network|database|storage|secrets|identity|registry|image|bootstrap|api|jobs|firebase|web|users|budget|smoke|iam_hardening|logging) "step_$1" ;;
  *) sed -n '2,8p' "$0"; exit 1 ;;
esac
