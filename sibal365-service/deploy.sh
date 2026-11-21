#!/usr/bin/env bash
set -euo pipefail
PROJECT=mindli-production
REGION=europe-west3
SERVICE=sibal365-challenges
BUCKET=mindli-production-sibal365-challenges-v1
SA=sibal365-challenges@mindli-production.iam.gserviceaccount.com
cd "$(dirname "$0")"
if ! gcloud iam service-accounts describe "$SA" --project="$PROJECT" >/dev/null 2>&1; then
 gcloud iam service-accounts create sibal365-challenges --display-name='SIBAL365 challenges only' --project="$PROJECT" --quiet
fi
if ! gcloud storage buckets describe "gs://$BUCKET" --project="$PROJECT" >/dev/null 2>&1; then
 gcloud storage buckets create "gs://$BUCKET" --project="$PROJECT" --location="$REGION" --uniform-bucket-level-access --public-access-prevention --default-storage-class=STANDARD --quiet
fi
# This bucket is dedicated to disposable SIBAL365 challenge metadata only.
gcloud storage buckets update "gs://$BUCKET" --soft-delete-duration=0 --lifecycle-file=lifecycle.json --project="$PROJECT" --quiet
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA" --role=roles/storage.objectAdmin --project="$PROJECT" --quiet
gcloud run deploy "$SERVICE" --project="$PROJECT" --region="$REGION" --source=. --service-account="$SA" --set-env-vars="SIBAL_BUCKET=$BUCKET" --allow-unauthenticated --min-instances=0 --max-instances=1 --concurrency=8 --cpu=1 --memory=256Mi --timeout=10 --no-cpu-boost --cpu-throttling --labels=app=sibal365,cost-profile=lean --quiet
gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format='yaml(status.url,spec.template.metadata.annotations)'
