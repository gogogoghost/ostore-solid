#!/bin/sh

set -e

./build.sh

adb push dist/ostore.zip /sdcard/

adb shell appscmd install /sdcard/ostore.zip