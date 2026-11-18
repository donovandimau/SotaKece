# Sota Kece on Google Play and the App Store

One Capacitor 8 project in `mobile/` builds both store apps.

- App ID: `com.sotakece.app` on both stores. It is permanent once uploaded.
- App name: `Sota Kece`
- The app opens the live site, https://sotakece.com, inside a native web view. Every site deploy updates the app, with no new store release.
- `mobile/www/offline.html` is the only bundled page. It shows when the site can't load, and retries when the phone comes back online.
- `scripts/cf-static-assets.mjs` keeps `mobile/` off the website.

Why the app loads the live site instead of bundling the files: sign-in, `/api`, the share links (`/s/`, `/t/`, `/p/`, `/i/`) and the Worker routes only work from the sotakece.com address.

The Android and iOS projects already ask for camera, microphone and photo access. Calls, voice notes and profile photos use them.

## Layout

| Path | What it is |
|---|---|
| `mobile/capacitor.config.json` | App ID, name, live address, offline page |
| `mobile/android/` | Android Studio project |
| `mobile/ios/` | Xcode project (Swift Package Manager, no CocoaPods) |
| `mobile/assets/logo.png` | Icon source; `npx @capacitor/assets@3.0.5 generate` rebuilds every icon and splash from it |
| `mobile/www/` | Offline page only |

After changing `capacitor.config.json` or adding a plugin, run this in `mobile/`:

```powershell
npm install
```

```powershell
npx cap sync
```

## Android (Google Play)

1. Install Android Studio from https://developer.android.com/studio and accept the SDK licence.
2. In `mobile/`, run `npx cap open android` and wait for Gradle sync to finish. Run it on a phone to check calls, the camera and music.
3. Build > Generate Signed App Bundle or APK > Android App Bundle. Create the key store the first time and keep the `.jks` file and its password forever, backed up offline. Choose `release`. The output is `mobile/android/app/release/app-release.aab`.
4. Play Console (https://play.google.com/console, $25 one-off): create the app, fill in the store listing, privacy policy `https://sotakece.com/privacy.html`, Data safety, content rating and target audience. Then upload the `.aab` to Closed testing.
5. Personal accounts made after November 2023 need at least 12 testers opted in for 14 days in a row before Production unlocks.

## iOS (App Store)

Building for iOS needs a Mac with Xcode 26 or later. You can use a Mac you own or rent, or a cloud Mac build service such as Codemagic or Ionic Appflow.

1. Join the Apple Developer Program ($99 a year) and create the app in App Store Connect with bundle ID `com.sotakece.app`.
2. On the Mac, in `mobile/`: `npm install`, `npx cap sync ios`, then `npx cap open ios`.
3. In Xcode: choose your team under Signing & Capabilities, then Product > Archive > Distribute App. Test it in TestFlight before you submit it for review.

## Gaps to close before submitting

- **Apple guideline 4.2 (minimum functionality).** Apple rejects apps that only show a website. Push notifications for messages, Top Mates and Talanoa replies (`@capacitor/push-notifications`, Firebase on Android, an APNs key on iOS) are the strongest native feature to add first.
- **User-generated content (Apple 1.2, Google UGC policy).** Social apps must let people report posts and block users, and must act on reports. Report and block are already live on the site. The reviewers will also want a published contact address and a named person who handles reports.
- **Account deletion (Apple 5.1.1(v), Google).** People must be able to delete their account from inside the app. "Delete my data" is already live; test it once inside the app with a throwaway account.
- **Google sign-in.** Google blocks its sign-in page inside app web views. Email and code sign-in work. Google sign-in needs `@capacitor/browser` or a native Google sign-in plugin.
- **iOS icon.** The App Store needs a 1024x1024 icon. The largest source is 512x512, so the current iOS icon is scaled up. Export a 1024 version, save it as `mobile/assets/logo.png`, and regenerate.
- **Server functions.** While Vercel is paused (Ops directive 15), any `/api/*` route that hasn't moved to the Worker fails in the app just as it does on the site.
