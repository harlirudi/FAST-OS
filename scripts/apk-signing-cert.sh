#!/bin/bash
# Cetak SHA-256 certificate signing APK (format colon) — verifikasi keystore
# hasil EAS build cocok dengan assetlinks.json (Android App Links).
#
# Usage: scripts/apk-signing-cert.sh <path-ke-apk>
#
# Catatan: apksigner butuh Java — memakai JBR bawaan Android Studio bila
# JAVA_HOME tidak di-set.
set -euo pipefail

APK="${1:?Usage: apk-signing-cert.sh <path-ke-apk>}"

JBR_JAVA="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java"
BUILD_TOOLS="${ANDROID_HOME:-$HOME/Library/Android/sdk}/build-tools"
APKSIGNER="$(ls "$BUILD_TOOLS"/*/lib/apksigner.jar 2>/dev/null | tail -1)"

if [[ -z "$APKSIGNER" ]]; then
  echo "apksigner.jar tidak ditemukan di $BUILD_TOOLS" >&2
  exit 1
fi

# JBR Android Studio lebih andal (java stub macOS /usr/bin/java tidak berfungsi)
if [[ -x "$JBR_JAVA" ]]; then
  JAVA="$JBR_JAVA"
elif command -v java >/dev/null 2>&1; then
  JAVA="java"
else
  echo "Java tidak ditemukan (butuh apksigner)" >&2
  exit 1
fi

"$JAVA" -jar "$APKSIGNER" verify --print-certs "$APK" 2>/dev/null \
  | grep "certificate SHA-256 digest" \
  | awk '{print $NF}' \
  | tr '[:lower:]' '[:upper:]' \
  | sed 's/\(..\)/\1:/g; s/:$//'
