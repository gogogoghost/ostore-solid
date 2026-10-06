#!/bin/sh

set -e

openssl pkeyutl -sign -rawin -inkey $PRIVATE_PEM_PATH -in dist/ostore.zip -out /tmp/ostore.sign.bin

curl -X POST https://api-ostore.yexm.eu.org/publish \
  -F "file=@dist/ostore.zip" \
  -F "sign=@/tmp/ostore.sign.bin" \
  -F "id=ostore"
