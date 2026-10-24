#!/usr/bin/env bash
# ProofPocket on Google Cloud (africa-south1, Johannesburg). Documented gcloud steps, safe to re-run.
#
#   bash infra/deploy.sh <step>      run one step
#   bash infra/deploy.sh all         run everything in order
#
# Steps: network, database, storage, secrets, identity, registry, image, bootstrap, api, firebase, web, users, budget, smoke
# Needs: gcloud and firebase CLIs signed in as a project owner, Node 26 + pnpm 12, python3.
set -euo pipefail

PROJECT="${PROJECT:-hackathons-warroom}"
REGION="${REGION:-africa-south1}"
SITE="${SITE:-proofpocket-aoty}"                         # Firebase Hosting site → https://$SITE.web.app
WEB_ORIGIN="https://${SITE}.web.app"
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
MAIL_USER="${MAIL_USER:-pegphina@gmail.com}"
HERE="$(cd "$(dirname "$0")" && pwd)"
SYSTEM="$HERE/../system"
TAG="${TAG:-$(git -C "$HERE/.." rev-parse --short HEAD)}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/api:${TAG}"

g() { gcloud --project "$PROJECT" --quiet "$@"; }
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
  cat > /tmp/proofpocket-cors.json <<EOF
[{"origin": ["${WEB_ORIGIN}", "https://${SITE}.firebaseapp.com"], "method": ["PUT", "GET"],
  "responseHeader": ["Content-Type", "x-goog-content-length-range"], "maxAgeSeconds": 3600}]
EOF
  g storage buckets update "gs://$BUCKET" --cors-file=/tmp/proofpocket-cors.json
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
  # Reads users to check Firebase sign-ins haven't been revoked.
  g projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA" --role roles/firebaseauth.viewer --condition=None >/dev/null
}

step_registry() {
  exists g artifacts repositories describe "$REPO" --location "$REGION" ||
    g artifacts repositories create "$REPO" --repository-format=docker --location "$REGION" --description "ProofPocket images"
}

step_image() {
  g builds submit "$SYSTEM" --tag "$IMAGE"
}

step_bootstrap() {
  # One-off job inside the VPC: migrations, the app role's password, and the example data (only into an empty database).
  local args=(--image "$IMAGE" --region "$REGION" --service-account "$SA" --network "$NETWORK" --subnet "$SUBNET" --vpc-egress private-ranges-only
    --set-secrets "DATABASE_OWNER_URL=proofpocket-db-owner-url:latest,APP_DB_PASSWORD=proofpocket-db-app-password:latest,ACCOUNT_NUMBER_KEY=proofpocket-account-key:latest"
    --set-env-vars "SEED_EXAMPLE_DATA=${SEED_EXAMPLE_DATA:-yes},SEED_ADMIN_EMAIL=${MAIL_USER}" --command node --args dist/bootstrap.js --max-retries 0 --task-timeout 600)
  if exists g run jobs describe proofpocket-bootstrap --region "$REGION"; then g run jobs update proofpocket-bootstrap "${args[@]}"
  else g run jobs create proofpocket-bootstrap "${args[@]}"; fi
  g run jobs execute proofpocket-bootstrap --region "$REGION" --wait
}

step_api() {
  g run deploy "$SERVICE" --image "$IMAGE" --region "$REGION" --service-account "$SA" \
    --network "$NETWORK" --subnet "$SUBNET" --vpc-egress private-ranges-only \
    --allow-unauthenticated --min-instances 0 --max-instances 4 --memory 512Mi --cpu 1 --concurrency 40 \
    --set-env-vars "NODE_ENV=production,TRUST_PROXY_HOPS=2,AUTH_MODE=firebase,FIREBASE_PROJECT_ID=${PROJECT},MAIL_MODE=smtp,SMTP_USER=${MAIL_USER},MAIL_FROM=ProofPocket <${MAIL_USER}>,STORAGE_MODE=gcs,GCS_BUCKET=${BUCKET},WEB_ORIGIN=${WEB_ORIGIN},PUBLIC_WEB_URL=${WEB_ORIGIN}" \
    --set-secrets "DATABASE_URL=proofpocket-db-app-url:latest,ACCOUNT_NUMBER_KEY=proofpocket-account-key:latest,OTP_SECRET=proofpocket-otp-secret:latest,SMTP_PASS=proofpocket-smtp-pass:latest"
}

step_firebase() {
  firebase projects:list 2>/dev/null | grep -q " $PROJECT " || firebase projects:addfirebase "$PROJECT"
  firebase hosting:sites:list --project "$PROJECT" 2>/dev/null | grep -q " $SITE " || firebase hosting:sites:create "$SITE" --project "$PROJECT"
  # Email + password sign-in (Firebase Authentication).
  curl -sf -X PATCH "https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired,authorizedDomains" \
    -H "Authorization: Bearer $(gcloud auth print-access-token)" -H "x-goog-user-project: ${PROJECT}" -H "Content-Type: application/json" \
    -d "{\"signIn\":{\"email\":{\"enabled\":true,\"passwordRequired\":true}},\"authorizedDomains\":[\"localhost\",\"${SITE}.web.app\",\"${SITE}.firebaseapp.com\",\"${PROJECT}.firebaseapp.com\"]}" >/dev/null
  firebase apps:list WEB --project "$PROJECT" 2>/dev/null | grep -q "ProofPocket web" || firebase apps:create WEB "ProofPocket web" --project "$PROJECT"
}

step_web() {
  # The Firebase web config is public by design (it identifies the project; access is controlled by the API and RLS).
  local app_id cfg
  app_id=$(firebase apps:list WEB --project "$PROJECT" --json | python3 -c "import json,sys;print([a['appId'] for a in json.load(sys.stdin)['result'] if a['displayName']=='ProofPocket web'][0])")
  cfg=$(firebase apps:sdkconfig WEB "$app_id" --project "$PROJECT" --json | python3 -c "import json,sys;r=json.load(sys.stdin)['result'];c=r.get('sdkConfig',r);print(c['apiKey'],c['authDomain'],c['projectId'],c['appId'])")
  read -r key domain pid aid <<<"$cfg"
  (cd "$SYSTEM/apps/web" && VITE_AUTH_MODE=firebase VITE_FIREBASE_API_KEY="$key" VITE_FIREBASE_AUTH_DOMAIN="${SITE}.firebaseapp.com" \
    VITE_FIREBASE_PROJECT_ID="$pid" VITE_FIREBASE_APP_ID="$aid" pnpm build)
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
    g billing budgets create --billing-account "$acct" --display-name "ProofPocket (hackathons-warroom)" \
      --budget-amount=600ZAR --filter-projects="projects/${PROJECT}" \
      --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0
}

step_smoke() {
  curl -sf "${WEB_ORIGIN}/api/v1/health" && echo
  curl -sfI "${WEB_ORIGIN}/" | grep -iE "^(strict-transport-security|content-security-policy|x-content-type-options):" || true
  curl -sf "${WEB_ORIGIN}/manifest.webmanifest" | python3 -c "import json,sys;m=json.load(sys.stdin);print('manifest:',m['name'],m['display'])"
}

case "${1:-}" in
  all) for s in network database storage secrets identity registry image bootstrap api firebase web users budget smoke; do echo "== $s"; "step_$s"; done ;;
  network|database|storage|secrets|identity|registry|image|bootstrap|api|firebase|web|users|budget|smoke) "step_$1" ;;
  *) sed -n '2,8p' "$0"; exit 1 ;;
esac
