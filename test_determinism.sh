#!/bin/sh
# Runs main.ts twice into two fresh directories and requires byte-identical output,
# and checks dossier.json parses. Exit 0 only when the hand-in is deterministic.
set -e
cd "$(dirname "$0")"
rm -rf /tmp/det-a /tmp/det-b
mkdir -p /tmp/det-a /tmp/det-b
MAKEFUN_OUTPUT_DIR=/tmp/det-a node main.ts
MAKEFUN_OUTPUT_DIR=/tmp/det-b node main.ts
diff -r /tmp/det-a /tmp/det-b
node -e "JSON.parse(require('fs').readFileSync('/tmp/det-a/dossier.json','utf8'))"
echo "determinism: PASS"
