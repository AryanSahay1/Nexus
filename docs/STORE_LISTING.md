# Google Play store listing — Nexus

This is **place 4 of 4** in the assistive-purpose declaration. The copy
below is what we'll paste into the Google Play Console fields. Every block
is intentionally explicit about Nexus being an **assistive technology** and
about how sensitive scopes are used, so the listing matches the in-app
disclosure (place 2) and the privacy policy (place 3).

---

## Category

**Primary:** *Tools → Accessibility*
**Secondary:** *Education* (the Learn tab is genuinely tutorial content)

> Choosing the *Accessibility* category — and the more conservative *Tools*
> primary instead of *Productivity* — both reduces the surface area of
> Google's content review and matches the actual purpose of the app.

## Tags

`accessibility`, `assistive technology`, `seniors`, `tutorial`, `learn-to-use-phone`,
`gmail tutorial`, `calendar tutorial`, `contacts tutorial`, `personal AI assistant`

## App title (≤ 30 chars)

```
Nexus — Learn & Assist
```

## Short description (≤ 80 chars)

```
Step-by-step phone tutorials and a personal AI helper that lives on your device.
```

## Long description

```
Nexus is an accessibility-first companion for your Android phone.

LEARN — built for first-time and elderly smartphone users
  • Step-by-step guides for Gmail, Google Calendar, Contacts, the Camera,
    and basic phone calls
  • Large text, plain language, one action per step — designed for users
    with reduced vision or limited tech experience
  • "Open Gmail" / "Open Calendar" / "Open Contacts" buttons take you
    straight to the right place in the system app
  • Works completely offline. No account, no API key, no internet
    connection required for the Learn tab.

CHAT — a private AI assistant that uses your own keys
  • Bring your own OpenAI key. Tokens stay on this phone, encrypted by the
    Android Keystore.
  • Connect Google (optional) and Nexus can draft Gmail messages,
    calendar events, social-media captions, and design briefs for you —
    always with a Confirm/Cancel card before anything is sent.
  • No advertising. No analytics SDK. No remote server. Nothing leaves
    the phone unless you ask it to.

PRIVACY BY DESIGN
  • All credentials live in the Android Keystore (EncryptedSharedPreferences,
    AES-256-GCM).
  • Personal data — emails, contacts, location — is never sent anywhere
    except the provider you explicitly chose (e.g. OpenAI, Google).
  • Read the full privacy policy in the app or at:
    github.com/AryanSahay1/Nexus/blob/main/docs/PRIVACY_POLICY.md
  • Factory reset wipes everything from this device with one tap.

WHO IS NEXUS FOR
  • Older adults learning to use a smartphone for the first time.
  • Family members who help an elderly parent and want a tool that walks
    them through the steps the same way every time.
  • Anyone who would rather keep their AI conversations private (your key,
    your bill, your data on your device).

SENSITIVE PERMISSIONS — used only with your direct confirmation
  Gmail (read recent / send), Calendar (read upcoming / create event):
    Nexus only acts on your behalf, and only after you tap Confirm on a
    card that shows you exactly what's about to happen. Nexus does NOT
    delete mail, does NOT post on your behalf to any social network, and
    does NOT scan your inbox in the background.
```

## Data Safety form answers

> Pasted as we'll fill the form in the Play Console.

| Question | Answer |
|---|---|
| Does your app collect or share any user data? | **No** — all data stays on the device. |
| Personal info (name, email, address, phone, race/ethnicity, sexual orientation, etc.) | Not collected or shared. The user's email may appear inside their own Google OAuth tokens, which never leave the device. |
| Financial info | Not collected or shared. |
| Health & fitness | Not collected or shared. |
| Messages (emails, SMS, MMS) | When the user explicitly connects Gmail, Nexus reads message headers locally to surface them in chat. Not collected or shared with us. |
| Photos / videos | Not collected. The Camera deep-link launches the system Camera; Nexus never accesses the gallery. |
| Audio | Not collected (voice input is opt-in and disabled by default). |
| Files & docs | Not collected. |
| Calendar | Same as messages — read/written only at the user's explicit request, never shared with us. |
| Contacts | Used in-process only when the user explicitly asks the AI to look up a contact on this device. Never sent to any server controlled by us. |
| App activity | Not collected. |
| App info & performance (crash logs, diagnostics) | Not collected. There is no crash reporter SDK in the build. |
| Device or other IDs | Not collected. |

## Sensitive-scope justification (OAuth verification)

If/when we ship a build with our own OAuth Client ID for users to sign in
with, we'll use this text in the OAuth verification request:

```
Nexus is an accessibility/assistive technology Android app built for
first-time and elderly smartphone users. Sensitive scopes (gmail.readonly,
gmail.send, calendar) are used exclusively to let the end user have an AI
assistant draft emails and calendar events on their behalf, with explicit
in-app Confirm/Cancel before any modifying call (send / create) is made.

Tokens are stored exclusively on the user's device in the Android Keystore
via androidx.security.crypto.EncryptedSharedPreferences and never reach
any server controlled by Nexus. There is no backend; the binary contains
no advertising, analytics or crash-reporting SDK.

In the current configuration each user supplies their own OAuth Client ID
inside the app, so the scopes are exercised only against the end user's
own data. The build verifying these scopes is identical to the one
distributed via Google Play.

Source code: github.com/AryanSahay1/Nexus
Privacy policy: github.com/AryanSahay1/Nexus/blob/main/docs/PRIVACY_POLICY.md
Demo video: <link to be supplied at submission time>
```

## Demo video script (90 s)

The OAuth verification reviewer needs a video showing each scope being used
*in context*. Outline:

1. (0–10 s) Open Nexus → Onboarding shows the assistive-purpose disclosure.
2. (10–25 s) Tap "Continue without a key" → land on the Learn tab → open
   the "Write your first email" tutorial → tap "Open Gmail" — reviewer
   sees the deep-link in action.
3. (25–45 s) Back to Nexus → Vault tab → enter OpenAI key → enter Google
   Client ID → Connect → consent screen → return to app, Vault shows
   Connected.
4. (45–70 s) Chat tab → "Send Sarah an email reminding her about dinner at
   8". Confirm card appears with full recipient/subject/body. Tap Confirm.
   Nexus calls `gmail.send` once.
5. (70–90 s) Settings → Factory reset → tokens are wiped, app returns to
   onboarding. Narration: "Nothing is left on any server."
