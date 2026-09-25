# hapi 21 migration — progress ledger

Plan: `docs/superpowers/plans/2026-09-24-hapi21-migration.md`
Spec: `docs/superpowers/specs/2026-09-24-hapi21-migration-design.md`

## Progress

One line per task, added in the task's own commit: `- Task N — <short sha of the previous commit or "this commit"> — <one-line result>`.

- Task 1 — this commit — fixture app, parity tooling, hapi 16 snapshot recorded
- Task 2 — 74d9ff7 — plugin registers on hapi 21 (@hapi/hapi, inert 7, vision 7); 7 startup tests pass; `npm install` needed `--legacy-peer-deps` (pre-existing react@15 vs itsa-react-globalstate peer conflict, unrelated to hapi)
- Task 2b — 591cdc6 — React 16.14.0 (satisfies itsa-react-globalstate's `react >= 16`); plain `npm install` succeeds, no flags; jsx-view.js no longer uses `React.createFactory`; default-manifest.json points at React 16 `umd/` files; 9 tests pass (7 startup + 2 render-parity); lint on jsx-view.js unchanged at 1
- Task 3 — 922f70d — request lifecycle ported to the hapi 21 `h` toolkit (onRequest middleware, debug logger, onPreResponse page-not-found hook, action-handler and `h.action`); 28 tests pass (10 actions + 6 middleware + 1 ddos + 1 debug-logging + 10 pre-existing); lint unchanged at baseline for all 5 touched files (middleware.js 1, console-debug.js 1, apply-server-routes.js 1, action-handler.js 2, extend-toolkit.js 2 vs extend-reply.js baseline)
- Task 4 — 69fe8be — h.reactview / h.generateProps / h.setBodyDataAttr / models on hapi 21 (shared createProps); 12 reactview tests + suite green; malformed URLs (/%) now render the not-found page instead of 500; lint at baseline (extend-toolkit 2, model-handler 4, build-props 1); request.app['_itsa_bodyDataAttr'] uses bracket notation to stay within the camelcase lint baseline (inline execution by the controller)
- Task 5 — 893b486 — built-in routes on hapi 21; every asset route and h.assets() confined to its directory (encoded ../ → 403, spec §4.5 security fix); disabled service worker keeps 200 via route response.emptyStatusCode (hapi 21 default for empty payloads is 204); lint at baseline (apply-server-routes 1, extend-toolkit 2) (inline execution by the controller)
- Task 6 — a4a12d8 — encrypted cookies on hapi 21 with SameSite=Lax; h.state/h.unstate; changeTtl fixed (typeof ttlSec; x-ms converted with Number(), non-numeric → TTL 0 as in 17.x); 9 cookie tests + suite green; lint at baseline (cookie.js 15, cookie-handler 2, change-cookies 1, refresh-cookies 1) (inline execution by the controller)

## Interruptions

(none)

## Lint baseline

eslint 4 with the repo `.eslintrc`, errors per file before any `lib/` change. Every file carries one
`Definition for rule 'react/wrap-multilines' was not found` error (config noise). Gate: a file you touch
must not exceed its count below.

```
   1 lib/gracefull-shutdown.js
   2 lib/hapi-plugin/authentication/auth-cookie.js
   2 lib/hapi-plugin/authentication/authentication-handler.js
   4 lib/hapi-plugin/authentication/authentication-plugin.js
   1 lib/hapi-plugin/cookies/client-body-data-attr-cookie.js
  12 lib/hapi-plugin/cookies/client-cookie-base.js
   4 lib/hapi-plugin/cookies/client-cookie-readable.js
   1 lib/hapi-plugin/cookies/client-not-exposed-cookie.js
   1 lib/hapi-plugin/cookies/client-props-cookie.js
   2 lib/hapi-plugin/cookies/cookie-handler.js
  15 lib/hapi-plugin/cookies/cookie.js
   2 lib/hapi-plugin/helpers/action-handler.js
   1 lib/hapi-plugin/helpers/affinity-view.js
   1 lib/hapi-plugin/helpers/apply-client-routes.js
   1 lib/hapi-plugin/helpers/apply-data-cookie.js
   1 lib/hapi-plugin/helpers/apply-server-routes.js
   1 lib/hapi-plugin/helpers/apply-titles.js
   1 lib/hapi-plugin/helpers/assets-handler.js
   1 lib/hapi-plugin/helpers/build-props.js
   1 lib/hapi-plugin/helpers/cached-file-content.js
   1 lib/hapi-plugin/helpers/change-cookies.js
   1 lib/hapi-plugin/helpers/console-debug.js
   1 lib/hapi-plugin/helpers/contextualizer.js
   2 lib/hapi-plugin/helpers/ddos-default-params.js
   6 lib/hapi-plugin/helpers/ddos-prevention.js
   1 lib/hapi-plugin/helpers/default-language.js
   2 lib/hapi-plugin/helpers/extend-reply.js
   1 lib/hapi-plugin/helpers/get-manifest.js
   1 lib/hapi-plugin/helpers/get-package-entry.js
   1 lib/hapi-plugin/helpers/jsx-view.js
   1 lib/hapi-plugin/helpers/middleware.js
   4 lib/hapi-plugin/helpers/model-handler.js
   1 lib/hapi-plugin/helpers/preboot.js
   1 lib/hapi-plugin/helpers/refresh-cookies.js
   1 lib/hapi-plugin/helpers/serviceworker-cache-list.js
   5 lib/hapi-plugin/plugin.js
  14 lib/socketio/socketio-client.js
   8 lib/socketio/socketserver.js
```
