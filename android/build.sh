#!/usr/bin/env bash
# Builds the Android app: build/R62D-android.apk. No Gradle: the SDK's own tools (aapt2, javac, d8, apksigner) from
# android/sdk.nix, fetched by Nix the first time (a few hundred MB, kept in the Nix store). Needs magick and zip/7z.
# Signing key: $R62D_ANDROID_KEY (default ~/.local/share/r62d/android-release.jks), made on first use. Keep it: an
# update signed with another key won't install over the old app (phones would have to uninstall first).
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")/.."
SDK=${ANDROID_TOOLS:-$(nix build --impure --no-link --print-out-paths -f android/sdk.nix)}
A=$SDK/libexec/android-sdk; BT=$A/build-tools/34.0.0; JAR=$A/platforms/android-34/android.jar
JDK=${JAVA_HOME_17:-$(nix build --no-link --print-out-paths nixpkgs#jdk17_headless)}/lib/openjdk
export JAVA_HOME=$JDK; PATH=$JDK/bin:$SDK/bin:$BT:$PATH
KEY=${R62D_ANDROID_KEY:-$HOME/.local/share/r62d/android-release.jks}
W=build/android; rm -rf "$W"; mkdir -p "$W"/{res,flat,classes,assets}
n=$(git rev-list --count HEAD); name="build $n"

# icon in each size Android asks for
for d in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  mkdir -p "$W/res/mipmap-${d%%:*}"; magick desktop/icon.png -resize "${d#*:}x${d#*:}" "$W/res/mipmap-${d%%:*}/icon.png"
done
# the start page, with the HOST-code reader (shared/joincode.js) put in as a plain script
awk '/\/\*JOINCODE\*\//{ while ((getline l < "shared/joincode.js") > 0) { sub(/^export /, "", l); print l } next } { print }' android/assets/start.html > "$W/assets/start.html"
sed "s/@CODE@/$n/; s/@NAME@/$name/" android/AndroidManifest.xml > "$W/AndroidManifest.xml"

aapt2 compile --dir "$W/res" -o "$W/flat"
aapt2 link -I "$JAR" --manifest "$W/AndroidManifest.xml" -A "$W/assets" -o "$W/base.apk" "$W"/flat/*.flat
javac -nowarn -source 11 -target 11 -cp "$JAR" -d "$W/classes" $(find android/src -name '*.java') 2>&1 | grep -v "^warning\|bootstrap class path" || true
d8 --release --min-api 24 --lib "$JAR" --output "$W" $(find "$W/classes" -name '*.class')
( cd "$W" && if command -v zip >/dev/null; then zip -q base.apk classes.dex; else 7z a -tzip -bso0 base.apk classes.dex; fi )
zipalign -f -p 4 "$W/base.apk" "$W/aligned.apk"
if [ ! -f "$KEY" ]; then
  mkdir -p "$(dirname "$KEY")"
  keytool -genkeypair -keystore "$KEY" -storepass r62d-android -keypass r62d-android -alias r62d -keyalg RSA -keysize 3072 \
    -validity 20000 -dname "CN=R62D, O=cblaney00" >/dev/null
  echo "Made a new signing key: $KEY (keep it)"
fi
apksigner sign --ks "$KEY" --ks-pass pass:r62d-android --ks-key-alias r62d --out build/R62D-android.apk "$W/aligned.apk"
apksigner verify build/R62D-android.apk
echo "Built build/R62D-android.apk ($(du -h build/R62D-android.apk | cut -f1)), $name"
