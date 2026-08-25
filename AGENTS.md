# AgentOS

## Mixpanel analytics

This product uses Mixpanel for first-party product analytics. Do not add a second analytics SDK (GA4, Amplitude client, Segment) unless the tracking plan is explicitly migrated.

### SDK and initialization

- Platform: web (Vite + React)
- Package: `mixpanel-browser` in `app/`
- Init: `startMixpanel()` in `app/src/main.jsx` (before React render)
- Wrapper: `app/src/shared/analytics/mixpanel.js` (SDK is bound from `mixpanelClient.js` in `main.jsx` so tests never load `mixpanel-browser`)
- Token: `VITE_MIXPANEL_TOKEN` (see `app/.env.example`). Fallback token is the current Mixpanel project. There is no separate development project yet — create one before sending noisy local traffic if you need a clean prod dataset.
- Consent: not gated. Init on app load. Do not add a consent banner unless legal/product asks for EU/CA opt-in.

### Identity

Use the database user id (`session.user.id`) as Mixpanel `$user_id`. Never identify by email.

| Moment | Call | Where |
|---|---|---|
| Email signup | `identify(user.id)` → `people.set` → `set_group` → `track('sign_up_completed')` | `app/src/shared/providers/AuthProvider.jsx` `signup` |
| Email login / session restore / org attached | `identify(user.id)` + profile + group | `AuthProvider.jsx` session effect |
| Google account created | same as signup, `sign_up_method: "google"` | `app/src/pages/GoogleAuthCallback.jsx` when `session.isNewUser === true` |
| Google login (existing user) | identify only, do **not** fire `sign_up_completed` | Google callback + AuthProvider session effect |
| Logout | `mixpanel.reset()` then clear session | `AuthProvider.jsx` `logout` |

Group analytics key: `organization_id` (workspace). Super property `platform` is always `"web"`.

### Tracking plan (shipped)

| Event | Trigger | Properties |
|---|---|---|
| `sign_up_completed` | Account created (email signup, or Google `isNewUser`) after identify | `sign_up_method` (`email` \| `google`), `platform` (`web`) |
| `prd_completed` | Virin analysis transitions from running/awaiting → `COMPLETED` with `generatedPrd` | `jira_key` (string), `prd_confidence` (number, omit if missing), `platform` (`web`) |

`prd_completed` is implemented in `useTrackPrdCompleted`, called from `usePmAnalysis` so every Virin poller shares one deduped fire per analysis id / Jira key. Do not fire when opening an already-completed PRD.

### Rules for new events

- Event names: `object_verb` in `snake_case` (past tense).
- Property names: `snake_case`. Never prefix custom properties with `$` or `mp_`.
- Omit `null`, `""`, and `undefined`. Send numbers as numbers, not strings.
- Call `trackEvent()` from `app/src/shared/analytics/mixpanel.js` — do not import `mixpanel-browser` in feature files.
- Identify before tracking authenticated events.
- Tests: `import.meta.env.MODE === "test"` no-ops the SDK. Keep it that way.
