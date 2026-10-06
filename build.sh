#!/bin/sh

set -e

# Fresh clones only ship the template; CI overrides the version through
# VITE_APP_VERSION instead of editing .env.production.
[ -f .env.production ] || cp .env.example .env.production

rm -rf dist

bun run build

cd dist

zip -r ostore.zip *