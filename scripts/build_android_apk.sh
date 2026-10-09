#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "  IAC Mobile - Android Release APK Build & Sign Script"
echo "=========================================================="

APP_NAME="iacmobile"
APP_VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
KEYSTORE_DIR="$ROOT_DIR/../keystores"
KEYSTORE_PATH="$KEYSTORE_DIR/iacmobile-release.keystore"
RELEASE_DIR="$ROOT_DIR/release"
OUTPUT_APK="$RELEASE_DIR/${APP_NAME}-v${APP_VERSION}-release.apk"

mkdir -p "$RELEASE_DIR"

# 1. Environment Verification
echo ""
echo "[1/6] Checking build environment prerequisites..."
if ! command -v node &> /dev/null; then
  echo "[-] Node.js is required. Please install Node.js (v18+ recommended)."
  exit 1
fi

if ! command -v javac &> /dev/null && ! command -v java &> /dev/null; then
  echo "[-] Java Development Kit (JDK 17 or 21) is required to build the Android APK."
  echo "    Install JDK:"
  echo "      Ubuntu/Debian: sudo apt update && sudo apt install -y openjdk-17-jdk"
  echo "      macOS: brew install openjdk@17"
  echo "      Windows: install Adoptium Temurin OpenJDK 17"
  exit 1
fi

if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
  echo "[!] Warning: Neither ANDROID_HOME nor ANDROID_SDK_ROOT is set."
  echo "    Ensure Android SDK Command-line Tools / SDK platforms (API 34/35) are installed."
fi

# 2. Build Frontend
echo ""
echo "[2/6] Building production web dashboard bundle..."
cd "$ROOT_DIR"
npm run build --workspace=frontend || npm run build

# 3. Capacitor Sync
echo ""
echo "[3/6] Syncing Capacitor Android assets & native plugins..."
npx cap sync android

# 4. Keystore Generation / Verification
echo ""
echo "[4/6] Verifying release signing keystore..."
mkdir -p "$KEYSTORE_DIR"

if [ ! -f "$KEYSTORE_PATH" ]; then
  echo "    Creating new release keystore outside repository at: $KEYSTORE_PATH"
  read -sp "    Enter a password for the release keystore (min 6 characters): " KS_PASS
  echo ""
  keytool -genkeypair -v \
    -keystore "$KEYSTORE_PATH" \
    -alias "iacmobile" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "$KS_PASS" \
    -keypass "$KS_PASS" \
    -dname "CN=IAC Mobile, OU=IAC Operations, O=Information Access Center, L=Accra, ST=Greater Accra, C=GH"
  
  echo "    ✓ Keystore generated. IMPORTANT: Back up $KEYSTORE_PATH securely!"
else
  echo "    ✓ Using existing keystore: $KEYSTORE_PATH"
  if [ -z "$KS_PASS" ]; then
    read -sp "    Enter keystore password: " KS_PASS
    echo ""
  fi
fi

# 5. Build Release APK with Gradle
echo ""
echo "[5/6] Building release APK via Gradle..."
cd "$ANDROID_DIR"
chmod +x gradlew

./gradlew assembleRelease \
  -PRELEASE_STORE_FILE="$KEYSTORE_PATH" \
  -PRELEASE_STORE_PASSWORD="$KS_PASS" \
  -PRELEASE_KEY_ALIAS="iacmobile" \
  -PRELEASE_KEY_PASSWORD="$KS_PASS"

# 6. Locate and copy release APK
echo ""
echo "[6/6] Copying release APK..."
GRADLE_APK="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
UNSIGNED_APK="$ANDROID_DIR/app/build/outputs/apk/release/app-release-unsigned.apk"

if [ -f "$GRADLE_APK" ]; then
  cp "$GRADLE_APK" "$OUTPUT_APK"
elif [ -f "$UNSIGNED_APK" ]; then
  echo "    Signing unsigned APK with apksigner / zipalign..."
  apksigner sign --ks "$KEYSTORE_PATH" --ks-pass "pass:$KS_PASS" --out "$OUTPUT_APK" "$UNSIGNED_APK"
fi

if [ -f "$OUTPUT_APK" ]; then
  echo ""
  echo "=========================================================="
  echo "  ✓ SUCCESS: Release APK generated!"
  echo "  Location: $OUTPUT_APK"
  echo "  Size: $(ls -lh "$OUTPUT_APK" | awk '{print $5}')"
  echo "=========================================================="
else
  echo "[-] Build completed, but could not locate the output APK."
  exit 1
fi
