# Google Play / OAuth review — the "4 places"

This file maps the **four places** where Nexus's assistive-technology
purpose has to be declared, exactly like the brief said. Reviewers tend to
cross-check between these surfaces; if any of them disagrees with the
others, the review fails. So we keep them aligned and link them from each
other.

---

## Place 1 — In-app: AndroidManifest meta-data

[`app/src/main/AndroidManifest.xml`](../app/src/main/AndroidManifest.xml)
contains two `<meta-data>` entries inside `<application>` that name the
purpose explicitly:

```xml
<meta-data
    android:name="com.nexus.app.PURPOSE"
    android:value="assistive_technology_for_first_time_smartphone_users" />
<meta-data
    android:name="com.nexus.app.SENSITIVE_SCOPES_USAGE"
    android:value="user_owned_data_only_with_explicit_per_action_confirmation" />
```

These are advisory tags — Android itself doesn't read them — but they make
the intent unambiguous to anyone reverse-engineering the APK and they tend
to be quoted back at us when reviewers diff the manifest against the
listing.

The same manifest also keeps the `<queries>` block restricted to **only the
apps the Learn tab teaches** (Gmail, Calendar, WhatsApp) plus the standard
intents the system apps respond to (`ACTION_DIAL`, `IMAGE_CAPTURE`, calendar
event INSERT, contacts VIEW). We do not declare `QUERY_ALL_PACKAGES`, so we
never see the full installed-app list.

## Place 2 — In-app: explicit user disclosure on first run

The first onboarding screen renders the
[`assistive_disclosure_*`](../app/src/main/res/values/strings.xml) strings
verbatim:

> **Built as an assistive helper.** Nexus is an accessibility tool: it
> teaches everyday tasks to people who are new to smartphones — older
> adults, first-time users, and anyone who wants step-by-step guidance.
> When you connect Gmail or Google Calendar, Nexus only acts on your
> behalf, with your explicit confirmation. Tokens stay on this phone,
> encrypted by the Android Keystore, and Nexus never sends your messages
> or contacts to anyone else.

The user must tap **"I understand"** to advance. After that, they have a
**"Continue without a key"** option that puts them in the Learn tab with no
network access at all. That demonstrates we don't *force* the user into the
sensitive-scope flow to use the app.

The disclosure is also cited verbatim in the Vault and Settings screens
when an OAuth scope is being granted.

## Place 3 — Google Play Privacy Policy

[`PRIVACY_POLICY.md`](PRIVACY_POLICY.md) is the public privacy policy. Key
sections:

- **§1** — names Nexus an "assistive technology app".
- **§2** — table of every data type, where it lives, and where it goes.
- **§4** — explains every sensitive Google scope and lists the in-app
  Confirm/Cancel gate.
- **§5** — explicitly states there is no Nexus-controlled backend and no
  third-party analytics/advertising SDK.
- **§6** — one-tap factory reset.

We host this file at the repo URL and paste that URL into the Play Console
"Privacy policy" field.

## Place 4 — Google Play store listing & OAuth justification

[`STORE_LISTING.md`](STORE_LISTING.md) is the copy that goes into the Play
Console. It re-uses exactly the same vocabulary as the in-app disclosure
("assistive technology", "first-time and elderly smartphone users",
"explicit Confirm/Cancel before any modifying call"). It also contains the
sensitive-scope justification block we paste into the OAuth verification
form when we request `gmail.readonly`, `gmail.send`, and `calendar`.

---

## Cross-checks reviewers run

| Reviewer asks | Where Nexus answers |
|---|---|
| "Is the assistive purpose obvious to users?" | Place 2 (onboarding screen the user must accept) |
| "Is the same purpose stated to Google?" | Places 3 + 4 |
| "Are sensitive scopes used only against user-owned data?" | Place 1 (`SENSITIVE_SCOPES_USAGE` meta-data), Place 3 §4, Place 4 OAuth justification |
| "Can the app be used without granting sensitive scopes?" | Place 2's "Continue without a key" → Learn tab works fully offline |
| "Where do tokens go?" | Place 3 §2: `EncryptedSharedPreferences` only, never to a Nexus-controlled server |
| "Where can the user see / revoke their data?" | Vault tab + Settings → Factory reset (Place 3 §6) |

## How to keep these four in sync

When the in-app disclosure copy is edited (`strings.xml` → the
`assistive_disclosure_*` keys), update the matching paragraph in
`PRIVACY_POLICY.md §1` and `STORE_LISTING.md`'s long description — the
review tooling will diff them. The CI workflow (`android-release.yml`) runs
`./gradlew :app:lintDebug` which fails when the in-app strings reference
non-existent keys, so at least the in-app side stays internally consistent.
