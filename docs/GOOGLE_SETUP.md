# Google Cloud setup — free, takes about 10 minutes

Nexus uses **your own** Google account through OAuth 2.0 PKCE — Gmail, Calendar, and Drive API calls are made against your account's free quota. You never enter an API key. You never enable billing.

This guide shows you how to configure the OAuth client ID that the app needs.

---

## What you'll end up with

A single string that looks like:

```
1234567890-abcdefg12345hijklmnop.apps.googleusercontent.com
```

You'll paste it into your local `.env` file as `EXPO_PUBLIC_GOOGLE_CLIENT_ID` — and that is the **only** Google credential the app ever sees.

---

## Step 1 — Create a Google Cloud project

1. Sign in to <https://console.cloud.google.com>.
2. Click the project dropdown at the top → **New Project**.
3. Name it `Nexus` (or anything). Click **Create**.
4. After the project is created, click the project dropdown again and select your new project so the rest of the wizard targets it.

> Total time: ~1 minute. **No billing required.**

## Step 2 — Enable the APIs

For each of the three APIs below, search for the API name in the top search bar, open the API page, and click **Enable**.

- Gmail API
- Google Calendar API
- Google Drive API

Each one toggles on instantly. You will not be asked for billing.

> Free quotas (verified at time of writing):
> - Gmail: 1,000,000,000 quota units/day per project.
> - Calendar: 1,000,000 queries/day.
> - Drive: 1,000,000,000 quota units/day.
>
> For a single user using a personal AI agent, this is effectively unlimited.

## Step 3 — OAuth consent screen

1. In the left sidebar, **APIs & Services → OAuth consent screen**.
2. User type: **External**. Click **Create**.
3. Fill in:
   - App name: `Nexus`
   - User support email: your own
   - Developer contact: your own
4. Click **Save and continue** through the next two screens (Scopes and Test users) — leave Scopes empty (the OAuth grant will request scopes at sign-in time) and add **your own Gmail address as a test user** under Test users so you can sign in without app verification.
5. Click **Back to dashboard** when done.

> While the app is in "Testing" mode, only Test users can sign in — but you can have up to 100 of them, no verification required, and no production review.

## Step 4 — Create the OAuth 2.0 client ID

1. In the left sidebar, **APIs & Services → Credentials**.
2. **+ Create Credentials → OAuth client ID**.
3. Application type:
   - **iOS** for production iOS builds
   - **Android** for production Android builds
   - **Desktop app** is fine for development on either platform via `react-native-app-auth`'s PKCE flow
4. Bundle ID / Package name: `com.nexus.app` (this matches `app.json`).
5. Click **Create**.
6. Copy the **Client ID** that appears in the dialog. This is the string you'll paste into `.env`.

> You do **not** receive a client secret for an iOS / Android / Desktop client — PKCE doesn't need one. Don't worry if there's no "Client Secret" field.

## Step 5 — Wire it into Nexus

In your local checkout:

```bash
cp .env.example .env
```

Open `.env` and set:

```
EXPO_PUBLIC_GOOGLE_CLIENT_ID=1234567890-abcdefg12345.apps.googleusercontent.com
```

Restart the dev server (`npx expo start`). On the Vault screen, tap **Connect Google** — Google's consent screen will appear. Approve, and Nexus will store the access + refresh tokens in the secure enclave (Keychain on iOS, Keystore on Android).

---

## Scopes Nexus requests

```
openid
email
profile
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.compose
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/drive.readonly
```

Drive is read-only — Nexus never writes to your Drive. Calendar covers read + event create/delete. Gmail covers read + send. The full scope strings are pinned in `src/services/oauthService.ts` and re-displayed on the Vault screen after a successful connection.

---

## Troubleshooting

**"Error 400: invalid_request" with `redirect_uri` mismatch.** Check that `app.json` has `"scheme": "nexus"` and that the iOS bundle / Android package is `com.nexus.app`. Also confirm the OAuth client was created with that exact bundle / package.

**"Access blocked: This app's request is invalid".** The most common cause is missing `prompt=consent` on the authorize call. Nexus passes this automatically (see `oauthService.buildGoogleConfig`); if you're forking the project, keep it.

**No refresh token received.** Google only emits a refresh token on the **first** consent. If you previously connected without `prompt=consent`, revoke Nexus on <https://myaccount.google.com/permissions> and reconnect. Nexus's PKCE config also forces `access_type=offline`.

**Quota exceeded.** Open Cloud Console → APIs & Services → Quotas. Personal use will not hit these limits. If you do, the agent surfaces a `RATE_LIMITED` error to the LLM so it can apologize and ask the user to try again.
