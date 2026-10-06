# ApartCare Lite V6.5.23 — Android Build Setup

The `android-app` directory is intentionally excluded from the Next.js web TypeScript project. It is a separate Capacitor project and must be installed/built independently.

## Web application
From the repository root:
```bat
npm install
npm run build
```

## Android test app
Prerequisites: Android Studio, Android SDK, and a compatible JDK.

```bat
cd android-app
npm install
set APARTCARE_WEB_URL=https://YOUR-APARTCARE-DOMAIN
npx cap add android
npx cap sync android
npx cap open android
```

Build a debug APK from Android Studio for device testing. The Android app uses the same deployed ApartCare web/API and database; it does not create a second database.

Do not put Android dependencies into the root Next.js package unless they are required by the web application.
