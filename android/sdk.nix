# The Android build tools for android/build.sh (fetched by Nix only while building; nothing is installed).
let pkgs = import (builtins.getFlake "nixpkgs") { system = "x86_64-linux"; config = { allowUnfree = true; android_sdk.accept_license = true; }; };
    a = pkgs.androidenv.composeAndroidPackages { platformVersions = [ "34" ]; buildToolsVersions = [ "34.0.0" ]; includeEmulator = false; includeSystemImages = false; includeNDK = false; };
in pkgs.symlinkJoin { name = "r62d-apk-tools"; paths = [ a.androidsdk ]; }
