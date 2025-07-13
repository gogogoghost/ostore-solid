#!/bin/sh

set -e

./build.sh

~/software/appscmd-x86_64-unknown-linux-gnu --socket /tmp/apps_service_uds.sock install $(pwd)/dist/ostore.zip