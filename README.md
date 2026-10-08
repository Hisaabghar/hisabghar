# Mera Khata

Ghar aur dukaan ka hisab. React + TypeScript + Vite on Firebase (Google Auth + Firestore),
hosted on Firebase Hosting (free Spark plan is enough).

- **Ghar ka Hisab** (PIN locked): aamdani, rozana kharcha by category, monthly khulasa
  (opening, aaye, kharch, bacha) and udhaar per person.
- **Dukaan / Business** (any day or month): Easypaisa/JazzCash with daily opening and
  closing balances, load per network, photocopy/print with configurable rates, mobile
  accessories, and online kaam (NADRA, certificates, license, forms) with pending/done.

## 1. Set up Firebase

The app uses the Firebase project `mera-khata-30f9b` (set in [`.firebaserc`](.firebaserc)).

1. In the [Firebase console](https://console.firebase.google.com), open the project.
2. **Authentication → Get started → Sign-in method → Google → Enable.**
3. **Firestore Database → Create database** (production mode, any region).
5. **Project settings → General → Your apps → Add app → Web (`</>`)**, register it, and
   copy the config values into a `.env` file (see [`.env.example`](.env.example)):
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=mera-khata-30f9b.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=mera-khata-30f9b
   VITE_FIREBASE_STORAGE_BUCKET=mera-khata-30f9b.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

### Data layout

All data for a user lives under `users/{uid}` in Firestore:

- `home/{id}` — `type` (income/expense), `category`, `amount`, `note`, `date`
- `loans/{id}` — `person`, `kind` (diya/liya/wapasMila/wapasKiya), `amount`, `date`
- `biz/{id}` — `kind` (wallet/load/copy/acc/online), `amount`, `profit`, `date`, plus kind fields
- `days/{YYYY-MM-DD}` — opening `cash`, `easypaisa`, `jazzcash`
- `meta/settings` — photocopy `rates` and the Ghar ka Hisab `pinHash`

[`firestore.rules`](firestore.rules) restricts each user to their own data.

## Deploy to Firebase Hosting

On Firebase Hosting no `.env` is needed: the app reads its config from
`/__/firebase/init.json`, which Hosting serves for the project's registered web app.

```bash
npm install -g firebase-tools
firebase login
npm run build
firebase deploy          # hosting + Firestore rules
```

The site is served at https://mera-khata-30f9b.web.app.

## 2. Run the app in dev

```bash
npm install
npm run dev
```

Open the printed local URL in a browser. Voice recording requires mic permission, which
browsers only grant on `localhost` or HTTPS.

## 3. Run it on an Android emulator/device (Capacitor)

The native Android project is already generated in `android/`. On a machine with
[Android Studio](https://developer.android.com/studio) (which includes the Android SDK)
installed:

```bash
npm run build       # builds the web app into dist/
npx cap sync android # copies dist/ into the native project
npx cap open android # opens the project in Android Studio
```

From Android Studio, press Run to install it on a connected device or emulator. Every
time you change the web code, re-run `npm run build && npx cap sync android` before
testing on device.

## 4. Building an installable .apk

This sandbox has no Android SDK and no network access to install one, so the APK itself
has to be built either on your own machine or via CI. Both paths are set up:

### Option A — Android Studio (fastest to get a real device install)

1. `npm run build && npx cap sync android`
2. `npx cap open android` (or open the `android/` folder directly in Android Studio)
3. **Build → Generate Signed Bundle / APK…** → APK → create a new keystore (or reuse one)
   → choose **release** (or **debug** for a quick unsigned test build) → Finish.
4. The APK lands in `android/app/release/` (or `android/app/build/outputs/apk/...`).
   Copy it to your phone and install it (enable "install unknown apps" for whichever app
   you transfer it with).

Keep the keystore file (`.jks`/`.keystore`) and its passwords somewhere safe — you need
the *same* keystore for every future signed release, or Android will refuse to let the
new APK replace the old install.

### Option B — GitHub Actions (no local Android Studio needed)

[`.github/workflows/android-build.yml`](.github/workflows/android-build.yml) builds a
**debug** APK automatically:

1. Push this repo to GitHub.
2. Add the six `VITE_FIREBASE_*` values from `.env` as repository secrets
   (**Settings → Secrets and variables → Actions**).
3. Run the workflow from the **Actions** tab (or push to `main`).
4. Download the `ledger-debug-apk` artifact and install it on your phone.

A debug APK works fine for personal use but is signed with a throwaway debug key. For a
"real" release build via CI, extend the workflow to run `./gradlew assembleRelease` with
a keystore decoded from a secret — ask if you'd like that added once you have a keystore.

## Project layout

```
src/
  components/        home/ (Ghar ka Hisab), biz/ (Dukaan), ui/ (shared kit)
  hooks/             useAuth, useData (live Firestore queries)
  lib/               Firebase client, Firestore paths, catalog lists, formatting
  types.ts
firebase.json        Hosting config + rules file locations
firestore.rules      Firestore security rules (owner-only)
android/             Capacitor-generated native Android project
```
