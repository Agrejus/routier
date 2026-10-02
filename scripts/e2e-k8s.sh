#!/usr/bin/env bash
set -euo pipefail

namespace=routier-e2e
root=$(cd "$(dirname "$0")/.." && pwd)
manifests="$root/deploy/k8s/e2e"
keep=0
project=e2e
jest_args=()
forwards=()

usage() {
    printf 'usage: e2e-k8s.sh [--keep] [--stress] [jest arguments...]\n'
}

while (($# > 0)); do
    case "$1" in
        --keep) keep=1 ;;
        --stress) project=stress ;;
        -h|--help) usage; exit 0 ;;
        *) jest_args+=("$1") ;;
    esac
    shift
done

cleanup() {
    for pid in "${forwards[@]}"; do
        kill "$pid" 2>/dev/null || true
    done

    if [ "$keep" = 0 ]; then
        kubectl delete namespace "$namespace" --wait=false >/dev/null 2>&1 || true
    fi
}

trap cleanup EXIT

existed=0
kubectl get namespace "$namespace" >/dev/null 2>&1 && existed=1

kubectl apply -k "$manifests" >/dev/null

if [ "$existed" = 1 ]; then
    kubectl -n "$namespace" delete pod --all --wait=true >/dev/null
fi

for deployment in postgres pgvector mysql mongo couchdb s3; do
    kubectl -n "$namespace" rollout status "deployment/$deployment" --timeout=600s >/dev/null
done

kubectl -n "$namespace" exec deployment/mongo -- mongosh --quiet --eval \
    'try { rs.status() } catch (error) { rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] }) }' >/dev/null

until kubectl -n "$namespace" exec deployment/mongo -- mongosh --quiet --eval 'db.hello().isWritablePrimary' | grep -q true; do
    sleep 1
done

forward() {
    kubectl -n "$namespace" port-forward "service/$1" "$2:$3" >/dev/null 2>&1 &
    forwards+=("$!")

    until (exec 3<>"/dev/tcp/127.0.0.1/$2") 2>/dev/null; do
        sleep 0.5
    done
}

forward postgres 15432 5432
forward pgvector 15433 5432
forward mysql 13306 3306
forward mongo 17017 27017
forward couchdb 15984 5984
forward s3 17070 7070

secret() {
    kubectl -n "$namespace" get secret e2e-credentials -o "jsonpath={.data.$1}" | base64 -d
}

export E2E_CONTAINERS=1

export ROUTIER_PG_HOST=127.0.0.1 ROUTIER_PG_PORT=15432 ROUTIER_PG_USER=postgres ROUTIER_PG_DATABASE=routier
ROUTIER_PG_PASSWORD=$(secret postgres-password)
export ROUTIER_PG_PASSWORD

export ROUTIER_PGVECTOR_HOST=127.0.0.1 ROUTIER_PGVECTOR_PORT=15433 ROUTIER_PGVECTOR_USER=postgres ROUTIER_PGVECTOR_DATABASE=routier
export ROUTIER_PGVECTOR_PASSWORD="$ROUTIER_PG_PASSWORD"

export ROUTIER_MYSQL_HOST=127.0.0.1 ROUTIER_MYSQL_PORT=13306 ROUTIER_MYSQL_USER=root ROUTIER_MYSQL_DATABASE=routier
ROUTIER_MYSQL_PASSWORD=$(secret mysql-root-password)
export ROUTIER_MYSQL_PASSWORD

export ROUTIER_MONGO_URL='mongodb://127.0.0.1:17017/?directConnection=true'

export ROUTIER_COUCHDB_URL=http://127.0.0.1:15984
ROUTIER_COUCHDB_USER=$(secret couchdb-user)
ROUTIER_COUCHDB_PASSWORD=$(secret couchdb-password)
export ROUTIER_COUCHDB_USER ROUTIER_COUCHDB_PASSWORD

export ROUTIER_S3_ENDPOINT=http://127.0.0.1:17070
ROUTIER_S3_ACCESS_KEY=$(secret s3-access-key)
ROUTIER_S3_SECRET_KEY=$(secret s3-secret-key)
export ROUTIER_S3_ACCESS_KEY ROUTIER_S3_SECRET_KEY

if [ "$project" = stress ]; then
    export STRESS=1 NODE_OPTIONS=--expose-gc
fi

cd "$root"
node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects "$project" "${jest_args[@]}"
