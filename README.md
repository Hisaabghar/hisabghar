# Ledger

A personal cashbook app for tracking a monthly allowance across multiple named accounts,
with voice notes on transactions. React + TypeScript + Vite, wrapped with Capacitor for
Android, backed by Supabase (Postgres + Auth + Storage).

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run everything in [`supabase/schema.sql`](supabase/schema.sql).
   This creates the `accounts` and `transactions` tables, enables Row Level Security with
   single-user (owner-only) policies, and creates a private `voice-notes` storage bucket
   with matching storage policies.
3. In **Project Settings → API**, copy the **Project URL** and **anon public** key.
4. Copy `.env.example` to `.env` and fill in those two values:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
5. By default Supabase requires email confirmation for new sign-ups. For fastest setup
   during development, you can disable that under **Authentication → Providers → Email →
   Confirm email**, or just confirm the email link once.

### Schema notes / future companion app

`accounts` and `transactions` both carry a `user_id` column and RLS policies keyed off
`auth.uid()`. A second "viewer" client (e.g. a companion app for a family member) can be
added later purely at the Supabase layer — either a read-only policy for a different
auth role, or an `account_shares` table joined into the select policies — without any
changes to these tables or to this app's code.

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
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository secrets
   (**Settings → Secrets and variables → Actions**).
3. Run the workflow from the **Actions** tab (or push to `main`).
4. Download the `ledger-debug-apk` artifact and install it on your phone.

A debug APK works fine for personal use but is signed with a throwaway debug key. For a
"real" release build via CI, extend the workflow to run `./gradlew assembleRelease` with
a keystore decoded from a secret — ask if you'd like that added once you have a keystore.

## Project layout

```
src/
  components/       UI (Ledger card, transaction list, modals)
  hooks/             useAuth, useAccounts, useTransactions, useVoiceRecorder
  lib/               supabase client, data mappers, voice note upload/signing, utils
  types.ts
supabase/schema.sql  Full DB schema, RLS policies, storage bucket + policies
android/             Capacitor-generated native Android project
```
