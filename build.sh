#!/bin/sh

set -e

rm -rf dist

bun run build

cd dist

zip -r ostore.zip *