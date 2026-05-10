# Privacy Policy — Nexus

**Effective:** 10 May 2026 · **Contact:** privacy@nexus.app (placeholder until publication)

This document is **place 3 of 4** in the Google Play assistive-purpose
declaration mapped in [`GOOGLE_COMPLIANCE.md`](GOOGLE_COMPLIANCE.md).

---

## 1. Who we are and what Nexus does

Nexus is a **personal accessibility / assistive technology app** for Android.
It exists to help two groups of people:

1. **First-time and elderly smartphone users** who are learning how to use the
   apps already on their phone (Gmail, Google Calendar, Contacts, the Camera,
   WhatsApp). Nexus's *Learn* tab teaches them step by step, with large
   text, plain language, and one action per step. **No account, no API key,
   no internet connection is required for this part of the app.**

2. **Smartphone users with everyday accessibility or comprehension needs**
   who want an AI assistant that can compose draft emails, calendar events,
   social-media captions and design briefs *under their direct supervision*.
   This part of the app uses the user's own OpenAI key and (optionally)
   Google account to act on their behalf.

Nexus is **not a social network**, **not an advertising platform**, and
**does not have a backend server that stores user data**.

## 2. What data Nexus handles, where it goes, and how long it stays

| Data | Purpose | Where it is stored | Sent to whom |
|---|---|---|---|
| Your OpenAI API key | Authenticates the AI assistant calls you make | `EncryptedSharedPreferences` on this device only (AES-256-GCM, AndroidX Security) | Only OpenAI's `chat/completions` endpoint, only as part of an outbound HTTPS request you triggered |
| Your Google OAuth tokens | Lets Nexus draft / send / read on your behalf when you ask it to | Same encrypted store, individual fields (no JSON blob) | Only Google's APIs (Gmail, Calendar) and Google's own OAuth refresh endpoint |
| Your Google Client ID | Used only to start OAuth | Same encrypted store | Only Google during the OAuth dance |
| Your conversation history | Lets the AI assistant remember context within a chat | Local SQLite database (Room) on this device only | Sent to OpenAI as part of the next chat completion call (so the model has context) |
| Your `user_preferences` ("memory") | Things you ask Nexus to remember | Same SQLite database | Sent to OpenAI as part of the system prompt of every chat call |
| Your Learn-tab progress | Used only to highlight where you left off | In-memory only (lost on app close in v2.0) | Nobody |

**There is no analytics SDK. No advertising SDK. No crash reporter that
uploads your data. No third-party network call other than the providers
listed above.** The `NexusLog` utility is privacy-safe by construction: it
runs an allowlist on field keys and a regex that scrubs tokens, emails, and
phone numbers from every logged message before it reaches Logcat.

## 3. Permissions Nexus requests, and why

| Permission | Used for | Granted by default? |
|---|---|---|
| `INTERNET`, `ACCESS_NETWORK_STATE` | Calling the OpenAI / Google APIs you've configured | Yes (install-time) |
| `READ_CONTACTS` | Optional — only used if you ask the AI to look up a contact you stored on this phone | No (runtime, you'll see a prompt) |
| `RECORD_AUDIO` | Optional — voice input via Whisper if/when enabled | No (runtime) |
| `POST_NOTIFICATIONS` | Optional — local reminders for calendar events you create | No (runtime) |
| `VIBRATE` | Confirmation feedback | Yes (install-time) |

Nexus uses the `<queries>` element in its manifest to *check whether* Gmail,
Calendar, Contacts, the dialler, Camera and WhatsApp are installed — so it
can show "Open Gmail" buttons in the Learn tab. We do **not** read the user's
list of installed apps.

## 4. Sensitive Google scopes (`gmail.readonly`, `gmail.send`, `calendar`)

When you, the user, choose to connect a Google account inside Nexus, Nexus
uses the OAuth scopes `gmail.readonly`, `gmail.send`, and `calendar` — but
only if you yourself enter your own OAuth Client ID in the Vault tab. Nexus
does not bundle a default Client ID and does not act as a single OAuth
client across users.

When connected, Nexus will:

- Show recent Gmail headers when you ask the AI assistant to read your
  inbox.
- Compose and **send** an email — but only after you tap a green **Confirm**
  button on a card that shows you the full recipient, subject and body.
- Read upcoming calendar events when you ask.
- Create a calendar event — again, only after you tap Confirm.

Nexus will **not** automatically read mail in the background, will not
delete anything, and will not send anything you have not explicitly
confirmed.

## 5. AI provider data handling

When you connect an OpenAI key, your messages, conversation history, and
the system prompt (which lists your `user_preferences`) are sent to OpenAI's
servers as part of the chat completion request. OpenAI's own data
processing terms apply to that request — Nexus has no special arrangement
with OpenAI; it's the standard developer-API contract. By using your own
key you control the billing relationship and you can revoke the key from
inside Nexus's Vault tab at any time.

If you want a complete on-device experience, **stay in Assistive Mode** —
the Learn tab does not contact any external server.

## 6. Data deletion

**Tap Settings → Factory reset.** Nexus wipes:

- the encrypted token store (`EncryptedSharedPreferences`),
- the SQLite database (chat history + preferences),
- all in-memory state.

Uninstalling the app deletes everything as well. Because nothing is stored
off-device, there is no server-side deletion request and no waiting period.

## 7. Children

Nexus is not directed at children under 13. The Learn tab is suitable for
all ages, but the AI assistant should be operated by an adult who can
supervise the conversation.

## 8. Changes to this policy

We will update this document in the same Git repository whenever the data
flow changes. The effective date at the top will be bumped accordingly.

## 9. Contact

For privacy questions, write to the contact email above.
