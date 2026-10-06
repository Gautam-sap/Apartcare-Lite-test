# ApartCare Lite Android V6.5.23

Lightweight Capacitor Android shell using the same deployed ApartCare frontend/API and tenant-scoped database. No second database is created.

Prerequisites: Android Studio + Android SDK + compatible JDK.

First setup:
```bat
cd android-app
npm install
set APARTCARE_WEB_URL=https://your-production-apartcare-domain
npx cap add android
npx cap sync android
npx cap open android
```

For client distribution, prefer a signed AAB through Google Play. For controlled trials, a signed APK can be hosted at the URL configured by `NEXT_PUBLIC_ANDROID_APP_DOWNLOAD_URL`.

## Test APK via GitHub Actions

Use **Actions → Build ApartCare Android Test APK → Run workflow** and enter the deployed Vercel/Web URL. The workflow creates the Android project, syncs Capacitor, builds `app-debug.apk`, and uploads it as a downloadable artifact.
