# ApartCare Lite V6.5.23 — Android Test APK

This repository now includes a GitHub Actions workflow that builds a debug APK using the same deployed ApartCare Web application/API.

## Build from GitHub Actions

1. Push the V6.5.23 source to GitHub.
2. Open **Actions → Build ApartCare Android Test APK**.
3. Click **Run workflow**.
4. Enter the deployed ApartCare Web URL, for example:
   `https://your-app.vercel.app`
5. Wait for the workflow to finish.
6. Open the completed workflow run and download the artifact:
   `apartcare-lite-v6.5.23-test-apk`
7. Extract the artifact and install `app-debug.apk` on the Android phone.

The APK uses the supplied HTTPS web URL and therefore does not require a second database. It uses the same ApartCare API/backend and tenant data as the Web application.

## Important

This is a **test APK**, not a Play Store production release. Android may require permission to install apps from the browser/file manager used to open the APK.

For production, generate a signed AAB and distribute it through Google Play Internal Testing.
