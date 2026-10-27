# Native iOS & Android (Capacitor)

StudySphere ships as a responsive web app and installable PWA. It is **not** a published App Store / Play Store app out of the box.

To produce native shells:

## Prerequisites

- Working production (or staging) web build
- Xcode (iOS) / Android Studio (Android)
- Node.js 20+

## Steps

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init StudySphere com.studysphere.app --web-dir dist
npm run build
npx cap add android
npx cap add ios
npx cap sync
```

Open native projects:

```bash
npx cap open android
npx cap open ios
```

## Notes

- Prefer loading the deployed HTTPS URL in the WebView for auth/cookie stability, or bundle `dist` and point Supabase Auth redirect URLs at the Capacitor app scheme.
- Push notifications require additional native plugins and a push provider — not included in v1 (in-app notifications only).
- Camera/file access for uploads may need Capacitor filesystem / share plugins depending on platform policies.
- Do not claim the web app is a native store listing until you complete store review and publish.
