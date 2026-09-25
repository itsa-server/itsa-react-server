# itsa-react-server 18.0.0 (hapi 21) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the itsa-react-server hapi plugin from hapi 16 to hapi 21 on hapi's native API, prove the behaviour is unchanged against a recorded hapi 16 snapshot, and close an asset path-traversal hole.

**Architecture:** The plugin keeps its structure: `lib/hapi-plugin/plugin.js` registers views, auth, cookies, middleware and the app's `src/routes.js`. `reply` decorations become hapi toolkit (`h`) decorations that *return* responses. A hand-written fixture app under `tests/fixtures/app/` plus `server.inject()` tests (Node's built-in `node:test`) cover every area; a parity test replays a request list against hapi 21 and compares with a snapshot recorded from the current hapi 16 code *before* any `lib/` change.

**Tech Stack:** Node 24, `@hapi/hapi` 21, `@hapi/inert` 7, `@hapi/vision` 7, `@hapi/boom` 10, React 15 (server rendering, unchanged), `node:test` + `node:assert`.

**Spec:** `docs/superpowers/specs/2026-09-24-hapi21-migration-design.md` — read it before starting any task; section numbers (§) below refer to it.

## Global Constraints

- Package version `18.0.0`; `peerDependencies`: `"@hapi/hapi": "^21"`; `engines.node`: `">=14"`.
- Dependencies replaced: `inert` → `@hapi/inert ^7`, `vision` → `@hapi/vision ^7`, `boom` → `@hapi/boom ^10`, `hoek` → `@hapi/hoek ^11`; `react` and `react-dom` → `^16.14.0` (spec §11, Task 2b). No other dependency changes. `devDependencies`: `@hapi/hapi ^21`.
- From Task 2b on, `npm install` must succeed **without** `--legacy-peer-deps`; never pass that flag or `--force`.
- `scripts.test`: `node --test --test-force-exit "tests/*.test.js"` (the plugin starts interval timers that never stop; `--test-force-exit` ends each test process after its tests finish).
- Plugin identity: `name: 'itsa-react-server'`, `version` from this repo's `package.json`.
- Cookies are registered with `isSameSite: 'Lax'`.
- Work only in this repository, on branch `DEV-hapi21`. Never touch `../website-heidata` or `../itsa-cli`. No npm publish, no push, no PR.
- JavaScript style (user rule): **always use curly brackets** for `if`/`else`/loops, even one-liners. Match the surrounding code: 4-space indent, single quotes, `const`/`let` declared at the top of a function, `function` (not arrow) for decorations that use `this`. In `lib/` do not use object spread, optional chaining or `??` (the repo's eslint 4 / babel-eslint 7 setup).
- Lint gate: after each task, `npx eslint -f unix <each lib file you changed>` must not report more errors for that file than the baseline recorded in the ledger (Task 1). A renamed file is compared against its old name's baseline.
- Plugin modules read `process.cwd()` when they are first required. Tests must `chdir` into the fixture app **before** requiring the plugin — always go through `tests/helpers/fixture.js`.
- Commit after every task with the attribution line `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`, and add a line to the ledger (`docs/superpowers/plans/2026-09-24-hapi21-migration-ledger.md`) in the same commit.

## Review Focus

1. **Async route handlers during client-route discovery** — `apply-client-routes.js` calls every GET handler with a stand-in toolkit at startup. An `async (request, h) => …` handler that calls something the stand-in lacks returns a *rejected promise*; on Node 24 an unhandled rejection kills the process at startup. Expected: startup succeeds, no unhandled rejection. Pinned in Task 2 (`tests/startup.test.js`).
2. **`debug: true`** (the default in the `development` environment of the default manifest) adds an `onRequest` logger to every request. Expected: requests still succeed and are logged. Pinned in Task 3 (`tests/debug-logging.test.js`).
3. **Query strings when a prefix is stripped** — `/nl/…?q=1` and `/_itsa_server_ajax_/props/<hash>/…?q=2` are rewritten with `request.setUrl()`. Expected: `request.query` keeps `q`. Pinned in Task 3 (`tests/middleware.test.js`).
4. **Non-numeric `x-ms` header on a cookie `ttl` action** — the new `Number()` conversion must not produce `NaN` TTLs or a 500. Expected: 200, cookie TTL 0 (the 17.x result). Pinned in Task 6 (`tests/cookies.test.js`).
5. **Protected routes declared with the legacy `config:` key** — hapi 21 still accepts `config:`; the plugin's own route inspection must too. Expected: the route is protected and reported as `privateView: true` to the client. Pinned in Task 7 (`tests/auth.test.js`).

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `tests/helpers/configs.js` | Named manifest overrides + env vars per fixture configuration (`plain`, `cookies`, `auth`) | 1 |
| `tests/helpers/fixture.js` | chdir into the fixture, link the package, build manifests, start a hapi 21 server, parse cookies and rendered props | 1 |
| `tests/fixtures/app/**` | Hand-written fixture app (hapi 21 style handlers) with a prebuilt `build/` | 1 |
| `tests/fixtures/app-hapi16/src/**` | Overlay: the same routes/actions/models written for hapi 16 (`reply` style), used once to record the snapshot | 1 |
| `tests/parity/requests.js` | The parity request list per configuration | 1 |
| `tests/parity/normalize.js` | Turns an inject response into a comparable record | 1 |
| `tests/parity/runner.js` | Child process: starts one configuration on hapi 16 or 21, replays its requests, writes records to a file | 1 |
| `tests/parity/record-hapi16.js` | One-off: builds the hapi 16 app copy and records `tests/fixtures/parity-hapi16.json` | 1 |
| `tests/fixtures/parity-hapi16.json` | Recorded hapi 16 snapshot (generated, committed) | 1 |
| `lib/hapi-plugin/plugin.js` | hapi 21 plugin object, startup sequence, `getServerOptions` | 2 |
| `lib/hapi-plugin/helpers/extend-reply.js` → `extend-toolkit.js` | Views setup and all toolkit decorations | 2, 3, 4, 5 |
| `lib/hapi-plugin/helpers/apply-client-routes.js` | Client route discovery (`options`/`config`, async-safe) | 2 |
| `lib/hapi-plugin/helpers/middleware.js` | DDoS guard, device affinity, ajax/language prefix stripping | 3 |
| `lib/hapi-plugin/helpers/console-debug.js` | Debug request logger | 3 |
| `lib/hapi-plugin/helpers/action-handler.js` | Runs `src/actions/*`, maps errors (§6.2) | 3 |
| `lib/hapi-plugin/helpers/apply-server-routes.js` | Page-not-found hook, built-in routes (confined), registers app routes | 2, 3, 5 |
| `lib/hapi-plugin/helpers/model-handler.js`, `build-props.js` | View models, `this.props` base | 4 |
| `lib/hapi-plugin/cookies/cookie.js`, `cookie-handler.js`, `helpers/change-cookies.js`, `helpers/refresh-cookies.js` | Encrypted cookies | 6 |
| `lib/hapi-plugin/authentication/authentication-handler.js`, `authentication-plugin.js` | Auth plugin, scheme, login/logout | 7 |
| `lib/socketio/socketserver.js` | socket.io on its own hapi 21 server | 2, 8 |
| `tests/*.test.js` | One file per area / configuration (each runs in its own process) | 2–9 |
| `MIGRATION-18.md`, `README.md`, `package.json`, `.npmignore` | Migration guide and release metadata | 10 |

---

### Task 1: Fixture app and hapi 16 parity baseline

Everything in this task runs against the **unchanged** hapi 16 code. Do not modify anything under `lib/` in this task.

**Files:**
- Create: `tests/helpers/configs.js`, `tests/helpers/fixture.js`
- Create: `tests/fixtures/app/` (all files listed in Steps 3–7)
- Create: `tests/fixtures/app-hapi16/src/` (Step 8)
- Create: `tests/parity/requests.js`, `tests/parity/normalize.js`, `tests/parity/runner.js`, `tests/parity/record-hapi16.js`
- Create (generated): `tests/fixtures/parity-hapi16.json`
- Create: `docs/superpowers/plans/2026-09-24-hapi21-migration-ledger.md`
- Modify: `.gitignore`
- Delete: `tests/itsa-hapi-react-server.js` (empty placeholder that requires chai, which is not installed)

**Interfaces:**
- Produces (used by every later task):
  - `tests/helpers/fixture.js` exports `REPO`, `FIXTURE_APP`, `useFixture(configName, appDir?) → appDir`, `buildManifest(appDir, configName, extraOverrides?) → manifest`, `startServer(configName, extraOverrides?) → Promise<hapi server>` (hapi 21, initialized, not listening), `parseSetCookies(res) → [{name, value, attributes}]` (attribute keys lower-cased; flag attributes are `true`), `cookieHeader(...responses) → 'a=1; b=2'`, `readViewProps(html) → object|null`.
  - `tests/helpers/configs.js` exports `{plain, cookies, auth}`, each `{env: {...}, overrides: {...}}`.
  - `tests/parity/runner.js` CLI: `node tests/parity/runner.js <16|21> <configName> <appDir> <outFile>`.
  - Fixture view names: `index`, `index@phone`, `not-found`, `login`, `private`; hashes `aaa111` (index), `bbb222` (index@phone), `ccc333` (not-found), `ddd444` (login), `eee555` (private).

- [ ] **Step 1: Create the ledger and record the lint baseline**

Run:

```bash
cd /Users/marco/Documents/Projects/itsa-react-server
npx eslint -f unix lib/hapi-plugin lib/socketio lib/gracefull-shutdown.js 2>/dev/null | grep -E '^/' | cut -d: -f1 | sed "s|$PWD/||" | sort | uniq -c
```

Create `docs/superpowers/plans/2026-09-24-hapi21-migration-ledger.md`:

````markdown
# hapi 21 migration — progress ledger

Plan: `docs/superpowers/plans/2026-09-24-hapi21-migration.md`
Spec: `docs/superpowers/specs/2026-09-24-hapi21-migration-design.md`

## Progress

One line per task, added in the task's own commit: `- Task N — <short sha of the previous commit or "this commit"> — <one-line result>`.

## Interruptions

(none)

## Lint baseline

eslint 4 with the repo `.eslintrc`, errors per file before any `lib/` change. Every file carries one
`Definition for rule 'react/wrap-multilines' was not found` error (config noise). Gate: a file you touch
must not exceed its count below.

```
<paste the command output here>
```
````

- [ ] **Step 2: Update `.gitignore` and remove the placeholder test**

Append to `.gitignore`:

```
tests/fixtures/**/node_modules/
tests/fixtures/.tmp-*/
```

Run: `git rm -q tests/itsa-hapi-react-server.js`

- [ ] **Step 3: Create the fixture app's metadata and manifest**

`tests/fixtures/app/package.json`:

```json
{
    "name": "fixture-app",
    "version": "1.0.0",
    "private": true
}
```

`tests/fixtures/app/.cookierc` (loaded with `require`, so it is JavaScript; passwords must be ≥ 32 characters):

```js
module.exports = {
    'app-authentication': 'fixture-app-authentication-password-0001',
    'body-data-attr': 'fixture-body-data-attr-cookie-password-02',
    'not-exposed': 'fixture-not-exposed-cookie-password-00003',
    'props': 'fixture-props-cookie-password-000000000004'
};
```

`tests/fixtures/app/cdn-cleanup.js` (required by `lib/cdn-cleanup.js` at load time):

```js
module.exports = {
    cleanup: async () => {}
};
```

`tests/fixtures/app/src/manifest.json`:

```json
{
    "port": 3001,
    "socketServer": {
        "enabled": false,
        "port": 4791,
        "proxy-port": 4791
    },
    "debug": false,
    "pageNotFoundView": "not-found",
    "showOffline": false,
    "ddos-prevention": {
        "enabled": false,
        "maxItemsOnPage": 150,
        "testmode": false,
        "silent": true,
        "silentStart": true
    },
    "app-authentication": {
        "enabled": false
    },
    "cookies": {},
    "client-props": {},
    "external-modules": [],
    "cdn": {
        "enabled": false,
        "cleanupPrevious": false,
        "url": ""
    },
    "babel-polyfill": false,
    "service-workers": {
        "enabled": false,
        "cacheAuthenticatedCode": true
    },
    "inline-pagecss": false,
    "page-description": "fixture app",
    "meta-viewport": {
        "desktop": "width=device-width",
        "phone": "width=device-width, user-scalable=no",
        "tablet": "width=device-width, user-scalable=no"
    },
    "languages": {
        "en": "default",
        "nl": true
    },
    "environments": {
        "test": {
            "host": "127.0.0.1",
            "port": 3999
        },
        "production": {
            "port": 8080
        }
    }
}
```

`tests/fixtures/app/src/pagetitles/en.json`:

```json
{
    "index": "Home",
    "index@phone": "Home phone",
    "not-found": "Not found",
    "login": "Log in",
    "private": "Private"
}
```

`tests/fixtures/app/src/pagetitles/nl.json`:

```json
{
    "index": "Thuis"
}
```

`tests/fixtures/app/src/file404.html`:

```html
<html><body>fixture 404</body></html>
```

- [ ] **Step 4: Create the prebuilt `build/` directory**

`tests/fixtures/app/build/build-stats.json`:

```json
[
    {"name": "index", "componentId": 1, "requireId": 11, "hash": "aaa111", "cssfile": "aaa111.css"},
    {"name": "index@phone", "componentId": 2, "requireId": 12, "hash": "bbb222", "cssfile": "bbb222.css"},
    {"name": "not-found", "componentId": 3, "requireId": 13, "hash": "ccc333", "cssfile": "ccc333.css"},
    {"name": "login", "componentId": 4, "requireId": 14, "hash": "ddd444", "cssfile": "ddd444.css"},
    {"name": "private", "componentId": 5, "requireId": 15, "hash": "eee555", "cssfile": "eee555.css"},
    {"isCommon": true, "hash": "common0", "cssfile": "common0.css"}
]
```

`tests/fixtures/app/build/view_components/_make.js` — builds a view component that renders its name plus a JSON dump of the props the tests inspect:

```js
'use strict';

const React = require('react');

module.exports = viewName => {
    class View extends React.Component {
        render() {
            const props = this.props,
                appProps = props.__appProps,
                shown = {
                    view: viewName,
                    appView: appProps.view,
                    lang: appProps.lang,
                    langprefix: appProps.langprefix,
                    locales: appProps.locales,
                    path: appProps.path,
                    uri: appProps.uri,
                    device: appProps.device,
                    title: appProps.title,
                    loggedIn: appProps.loggedIn,
                    scope: appProps.scope,
                    cookie: appProps.cookie,
                    bodyattrcookie: appProps.bodyattrcookie,
                    initialGlobalState: appProps.initialGlobalState,
                    bodyDataAttr: props.__bodyDataAttr,
                    authentication: props.authentication,
                    authenticationMsg: props.authenticationMsg,
                    fromModel: props.fromModel,
                    modelGotToolkit: props.modelGotToolkit,
                    general: props.general,
                    generalGotToolkit: props.generalGotToolkit,
                    itsapagescript: appProps.itsapagescript,
                    itsapagelinkcss: appProps.itsapagelinkcss
                };
            return React.createElement('html', null,
                React.createElement('body', null,
                    React.createElement('h1', null, viewName),
                    React.createElement('pre', {id: 'props'}, JSON.stringify(shown))));
        }
    }
    return View;
};
```

Five view files, each one line (`jsx-view.js` requires the file and reads `global.__viewComponent`):

- `tests/fixtures/app/build/view_components/index.js`: `global.__viewComponent = require('./_make')('index');`
- `tests/fixtures/app/build/view_components/index@phone.js`: `global.__viewComponent = require('./_make')('index@phone');`
- `tests/fixtures/app/build/view_components/not-found.js`: `global.__viewComponent = require('./_make')('not-found');`
- `tests/fixtures/app/build/view_components/login.js`: `global.__viewComponent = require('./_make')('login');`
- `tests/fixtures/app/build/view_components/private.js`: `global.__viewComponent = require('./_make')('private');`

Static files — the tests compare exact bodies, so these files have **no trailing newline**. Create them with:

```bash
cd tests/fixtures/app/build
mkdir -p private/assets/js private/assets/css public/assets/1.0.0/sub public/assets/1.0.0/_itsa_server_commons \
    public/assets/_itsa_server_external_modules/react private/assets-private/1.0.0
printf '%s' "window.itsaView='index';" > private/assets/js/aaa111.js
printf '%s' "window.itsaView='index@phone';" > private/assets/js/bbb222.js
printf '%s' "window.itsaView='login';" > private/assets/js/ddd444.js
printf '%s' 'h1{color:red}' > private/assets/css/aaa111.css
printf '%s' 'h1{color:blue}' > private/assets/css/bbb222.css
printf '%s' 'h1{color:green}' > private/assets/css/ddd444.css
printf '%s' 'hello asset' > public/assets/1.0.0/hello.txt
printf '%s' 'deep asset' > public/assets/1.0.0/sub/deep.txt
printf '%s' 'fixture-icon' > public/assets/1.0.0/favicon.ico
printf '%s' 'window.itsaCommon=true;' > public/assets/1.0.0/_itsa_server_commons/common0.js
printf '%s' 'body{margin:0}' > public/assets/1.0.0/_itsa_server_commons/common0.css
printf '%s' 'window.itsaExternal=true;' > public/assets/_itsa_server_external_modules/react/x.js
printf '%s' 'private asset' > private/assets-private/1.0.0/secret.txt
cd -
```

- [ ] **Step 5: Create the fixture's hapi 21 routes**

`tests/fixtures/app/src/routes.js`:

```js
'use strict';

// Fixture routes in hapi 21 style: every handler returns.
// `options:` and the legacy `config:` key are both used on purpose.

const routes = [
    {method: 'GET', path: '/', handler: (request, h) => h.reactview('index')},
    {method: 'GET', path: '/missing-view', handler: (request, h) => h.reactview('does-not-exist')},
    {
        method: 'GET',
        path: '/bodydata',
        handler: (request, h) => {
            h.setBodyDataAttr({theme: 'dark', count: 2});
            return h.reactview('index');
        }
    },
    {
        method: 'GET',
        path: '/generated-props',
        handler: async (request, h) => {
            const props = await h.generateProps('index');
            return {
                view: props.__appProps.view,
                fromModel: props.fromModel,
                general: props.general,
                authentication: props.authentication
            };
        }
    },
    {method: 'GET', path: '/asset-helper', handler: (request, h) => h.assets('hello.txt')},
    {method: 'GET', path: '/asset-helper/{file*}', handler: (request, h) => h.assets(request.params.file)},
    {method: 'GET', path: '/act/value', handler: (request, h) => h.action('value')},
    {method: 'GET', path: '/act/empty', options: {handler: (request, h) => h.action('empty')}},
    {method: 'GET', path: '/act/response', config: {handler: (request, h) => h.action('response')}},
    {method: 'GET', path: '/act/stream', handler: (request, h) => h.action('stream')},
    {method: 'GET', path: '/act/boom', handler: (request, h) => h.action('boom')},
    {method: 'GET', path: '/act/throws', handler: (request, h) => h.action('throws')},
    {method: 'GET', path: '/act/missing', handler: (request, h) => h.action('does-not-exist')},
    {method: 'GET', path: '/act/not-a-function', handler: (request, h) => h.action('not-a-function')},
    {method: 'GET', path: '/act/legacy', handler: (request, h) => h.action('legacy')},
    {method: 'GET', path: '/act/options', handler: (request, h) => h.action('options', {inline: true})},
    {method: 'POST', path: '/act/payload', handler: (request, h) => h.action('payload')},
    {method: 'GET', path: '/act/request-info', handler: (request, h) => h.action('request-info')},
    {method: 'GET', path: '/act/cookies', handler: (request, h) => h.action('cookies')},
    {method: 'GET', path: '/act/set-notexposed', handler: (request, h) => h.action('set-notexposed')}
];

if (process.env.ITSA_FIXTURE_AUTH==='true') {
    routes.push(
        {method: 'GET', path: '/public', handler: (request, h) => h.reactview('index')},
        {
            method: 'GET',
            path: '/private',
            options: {
                auth: {strategy: 'fixture', scope: ['user', 'admin']},
                handler: (request, h) => h.reactview('private')
            }
        },
        {
            method: 'GET',
            path: '/admin',
            options: {
                auth: {strategy: 'fixture', scope: ['admin']},
                handler: (request, h) => h.reactview('private')
            }
        },
        {
            method: 'GET',
            path: '/legacy-config-private',
            config: {
                auth: {strategy: 'fixture', scope: ['user']},
                handler: (request, h) => h.reactview('private')
            }
        },
        {method: 'POST', path: '/login', handler: (request, h) => h.action('login')},
        {method: 'POST', path: '/logout', handler: (request, h) => h.action('logout')}
    );
}

if (process.env.ITSA_FIXTURE_BROKEN_ROUTES==='true') {
    throw new Error('fixture: broken routes');
}

module.exports = routes;
```

- [ ] **Step 6: Create the fixture's actions**

All under `tests/fixtures/app/src/actions/`:

`value.js`:

```js
module.exports = async (request, h, options, language) => ({hello: 'world', language});
```

`empty.js`:

```js
module.exports = async () => undefined;
```

`response.js`:

```js
module.exports = async (request, h) => h.response({created: true}).code(201).header('x-custom', 'yes');
```

`stream.js`:

```js
const {Readable} = require('stream');

module.exports = async (request, h) => {
    const stream = new Readable({
        read() {
            this.push('chunk-1,');
            this.push('chunk-2');
            this.push(null);
        }
    });
    return h.response(stream)
        .header('content-type', 'text/plain; charset=utf-8')
        .header('content-disposition', 'attachment; filename="data.txt"');
};
```

`boom.js`:

```js
const Boom = require('@hapi/boom');

module.exports = async () => {
    throw Boom.conflict('Project locked');
};
```

`throws.js`:

```js
module.exports = async () => {
    throw new Error('secret internals');
};
```

`not-a-function.js`:

```js
module.exports = {notAFunction: true};
```

`legacy.js` (an unmigrated action that still calls the toolkit like hapi 16's `reply`):

```js
module.exports = async (request, h) => {
    h({legacy: true});
};
```

`options.js`:

```js
module.exports = async (request, h, options, language) => ({options, language});
```

`payload.js`:

```js
module.exports = async request => ({payload: request.payload});
```

`request-info.js`:

```js
module.exports = async request => ({
    path: request.path,
    query: request.query,
    language: request.language,
    locales: request.locales,
    languageSwitch: !!request.languageSwitch,
    affinity: request.affinity,
    ajaxtype: request.headers['x-ajaxtype'] || null
});
```

`cookies.js` (only requested in the `cookies` configuration, where these request decorations exist):

```js
module.exports = async request => ({
    props: request.getPropsCookie().getProps(),
    bodydata: request.getBodyDataAttrCookie().getProps(),
    notexposed: request.getNotExposedCookie().getProps(),
    globalstate: request.getClientGlobalstate()
});
```

`set-notexposed.js`:

```js
module.exports = async (request, h) => {
    request.getNotExposedCookie().defineProps(h, {secret: 'value'});
    return {status: 'set'};
};
```

`login.js`:

```js
module.exports = async (request, h) => {
    const payload = request.payload || {};
    h.login({user: 'fixture-user', scope: payload.scope || 'user', blocked: !!payload.blocked});
    return {status: 'loggedin'};
};
```

`logout.js`:

```js
module.exports = async (request, h) => {
    h.logout();
    return {status: 'loggedout'};
};
```

- [ ] **Step 7: Create the fixture's models, general model, globalstate and auth validation**

`tests/fixtures/app/src/models/index.js`:

```js
module.exports = async (request, h) => ({fromModel: 42, modelGotToolkit: typeof h.reactview==='function'});
```

`tests/fixtures/app/src/model-general.js`:

```js
module.exports = async (request, h) => ({general: 'yes', generalGotToolkit: typeof h.reactview==='function'});
```

`tests/fixtures/app/src/initial-globalstate.js`:

```js
module.exports = async (request, h) => ({counter: 1, stateGotToolkit: typeof h.reactview==='function'});
```

`tests/fixtures/app/src/authentication/validate.js`:

```js
module.exports = async (request, h, authCookie) => {
    const props = authCookie.getProps();
    if (request.query.logout==='toolkit') {
        h.logout();
        return false;
    }
    if (!authCookie.isLoggedIn()) {
        return false;
    }
    if (props.blocked) {
        return 'Account blocked';
    }
    return true;
};
```

- [ ] **Step 8: Create the hapi 16 overlay**

These files replace their counterparts in a temporary copy of the fixture when recording the hapi 16 snapshot. They must behave exactly like the hapi 21 versions, written against hapi 16's `reply`. hapi 16 does not know the `options:` route key, so every route uses `config:`. Handlers must not be `async` (hapi 16's route inspection would leave a rejected promise).

`tests/fixtures/app-hapi16/src/routes.js`:

```js
'use strict';

// hapi 16 twin of tests/fixtures/app/src/routes.js — same paths, same behaviour, `reply` style.

const routes = [
    {method: 'GET', path: '/', handler: function(request, reply) { reply.reactview('index'); }},
    {method: 'GET', path: '/missing-view', handler: function(request, reply) { reply.reactview('does-not-exist'); }},
    {
        method: 'GET',
        path: '/bodydata',
        handler: function(request, reply) {
            reply.setBodyDataAttr({theme: 'dark', count: 2});
            reply.reactview('index');
        }
    },
    {
        method: 'GET',
        path: '/generated-props',
        handler: function(request, reply) {
            reply.generateProps('index').then(props => {
                reply({
                    view: props.__appProps.view,
                    fromModel: props.fromModel,
                    general: props.general,
                    authentication: props.authentication
                });
            });
        }
    },
    {method: 'GET', path: '/asset-helper', handler: function(request, reply) { reply.assets('hello.txt'); }},
    {method: 'GET', path: '/asset-helper/{file*}', handler: function(request, reply) { reply.assets(request.params.file); }},
    {method: 'GET', path: '/act/value', handler: function(request, reply) { reply.action('value'); }},
    {method: 'GET', path: '/act/empty', config: {handler: function(request, reply) { reply.action('empty'); }}},
    {method: 'GET', path: '/act/response', config: {handler: function(request, reply) { reply.action('response'); }}},
    {method: 'GET', path: '/act/stream', handler: function(request, reply) { reply.action('stream'); }},
    {method: 'GET', path: '/act/boom', handler: function(request, reply) { reply.action('boom'); }},
    {method: 'GET', path: '/act/throws', handler: function(request, reply) { reply.action('throws'); }},
    {method: 'GET', path: '/act/missing', handler: function(request, reply) { reply.action('does-not-exist'); }},
    {method: 'GET', path: '/act/not-a-function', handler: function(request, reply) { reply.action('not-a-function'); }},
    {method: 'GET', path: '/act/options', handler: function(request, reply) { reply.action('options', {inline: true}); }},
    {method: 'POST', path: '/act/payload', handler: function(request, reply) { reply.action('payload'); }},
    {method: 'GET', path: '/act/request-info', handler: function(request, reply) { reply.action('request-info'); }},
    {method: 'GET', path: '/act/cookies', handler: function(request, reply) { reply.action('cookies'); }},
    {method: 'GET', path: '/act/set-notexposed', handler: function(request, reply) { reply.action('set-notexposed'); }}
];

if (process.env.ITSA_FIXTURE_AUTH==='true') {
    routes.push(
        {method: 'GET', path: '/public', handler: function(request, reply) { reply.reactview('index'); }},
        {
            method: 'GET',
            path: '/private',
            config: {
                auth: {strategy: 'fixture', scope: ['user', 'admin']},
                handler: function(request, reply) { reply.reactview('private'); }
            }
        },
        {
            method: 'GET',
            path: '/admin',
            config: {
                auth: {strategy: 'fixture', scope: ['admin']},
                handler: function(request, reply) { reply.reactview('private'); }
            }
        },
        {
            method: 'GET',
            path: '/legacy-config-private',
            config: {
                auth: {strategy: 'fixture', scope: ['user']},
                handler: function(request, reply) { reply.reactview('private'); }
            }
        },
        {method: 'POST', path: '/login', handler: function(request, reply) { reply.action('login'); }},
        {method: 'POST', path: '/logout', handler: function(request, reply) { reply.action('logout'); }}
    );
}

module.exports = routes;
```

Overlay actions, all under `tests/fixtures/app-hapi16/src/actions/` (actions not listed here don't use `reply` and are shared):

`response.js`:

```js
module.exports = async (request, reply) => {
    reply({created: true}).code(201).header('x-custom', 'yes');
};
```

`stream.js`:

```js
const {Readable} = require('stream');

module.exports = async (request, reply) => {
    const stream = new Readable({
        read() {
            this.push('chunk-1,');
            this.push('chunk-2');
            this.push(null);
        }
    });
    reply(stream)
        .header('content-type', 'text/plain; charset=utf-8')
        .header('content-disposition', 'attachment; filename="data.txt"');
};
```

`boom.js`:

```js
const Boom = require('boom');

module.exports = async () => {
    throw Boom.conflict('Project locked');
};
```

`set-notexposed.js`:

```js
module.exports = async (request, reply) => {
    request.getNotExposedCookie().defineProps(reply, {secret: 'value'});
    return {status: 'set'};
};
```

`login.js`:

```js
module.exports = async (request, reply) => {
    const payload = request.payload || {};
    reply.login({user: 'fixture-user', scope: payload.scope || 'user', blocked: !!payload.blocked});
    return {status: 'loggedin'};
};
```

`logout.js`:

```js
module.exports = async (request, reply) => {
    reply.logout();
    return {status: 'loggedout'};
};
```

`tests/fixtures/app-hapi16/src/models/index.js`:

```js
module.exports = async (request, reply) => ({fromModel: 42, modelGotToolkit: typeof reply.reactview==='function'});
```

`tests/fixtures/app-hapi16/src/model-general.js`:

```js
module.exports = async (request, reply) => ({general: 'yes', generalGotToolkit: typeof reply.reactview==='function'});
```

`tests/fixtures/app-hapi16/src/initial-globalstate.js`:

```js
module.exports = async (request, reply) => ({counter: 1, stateGotToolkit: typeof reply.reactview==='function'});
```

`tests/fixtures/app-hapi16/src/authentication/validate.js`:

```js
module.exports = async (request, reply, authCookie) => {
    const props = authCookie.getProps();
    if (request.query.logout==='toolkit') {
        reply.logout();
        return false;
    }
    if (!authCookie.isLoggedIn()) {
        return false;
    }
    if (props.blocked) {
        return 'Account blocked';
    }
    return true;
};
```

- [ ] **Step 9: Create the test helpers**

`tests/helpers/configs.js`:

```js
'use strict';

// Named fixture configurations: manifest overrides plus environment variables the fixture's
// src/routes.js reads. Each test file uses one configuration (one per process), because the
// plugin keeps module-level state (cookie registrations, view caches).

module.exports = {
    plain: {
        env: {},
        overrides: {}
    },
    cookies: {
        env: {},
        overrides: {
            cookies: {
                'body-data-attr': {enabled: true, onlySsl: false, 'ttl-sec': 31536000},
                'not-exposed': {enabled: true, onlySsl: false, 'ttl-sec': 31536000},
                props: {enabled: true, onlySsl: false, 'ttl-sec': 31536000},
                globalstate: {enabled: true, onlySsl: false, 'ttl-sec': 365}
            }
        }
    },
    auth: {
        env: {ITSA_FIXTURE_AUTH: 'true'},
        overrides: {
            'app-authentication': {
                enabled: true,
                onlySsl: false,
                'session-cookie': false,
                'ttl-sec': 1800,
                loginView: 'login',
                strategies: [
                    {strategy: 'fixture', validateFunc: 'src/authentication/validate'}
                ]
            }
        }
    }
};
```

`tests/helpers/fixture.js`:

```js
'use strict';

const fs = require('fs'),
    path = require('path'),
    CONFIGS = require('./configs'),
    REPO = path.resolve(__dirname, '..', '..'),
    FIXTURE_APP = path.join(REPO, 'tests', 'fixtures', 'app');

const isObject = value => (value!==null) && (typeof value==='object') && !Array.isArray(value);

const deepMerge = (target, source) => {
    Object.keys(source).forEach(key => {
        if (isObject(source[key]) && isObject(target[key])) {
            deepMerge(target[key], source[key]);
        }
        else {
            target[key] = source[key];
        }
    });
    return target;
};

// the plugin reads files through `<cwd>/node_modules/itsa-react-server/...`
const linkPackage = appDir => {
    const modulesDir = path.join(appDir, 'node_modules'),
        link = path.join(modulesDir, 'itsa-react-server');
    fs.mkdirSync(modulesDir, {recursive: true});
    if (!fs.existsSync(link)) {
        fs.symlinkSync(REPO, link, 'dir');
    }
};

// Must run BEFORE the plugin is required: plugin modules read process.cwd() when they load.
const useFixture = (configName, appDir) => {
    const config = CONFIGS[configName];
    appDir = appDir || FIXTURE_APP;
    process.env.NODE_ENV = 'test';
    Object.keys(config.env).forEach(key => {
        process.env[key] = config.env[key];
    });
    linkPackage(appDir);
    process.chdir(appDir);
    return appDir;
};

const buildManifest = (appDir, configName, extraOverrides) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(appDir, 'src', 'manifest.json'), 'utf8'));
    deepMerge(manifest, JSON.parse(JSON.stringify(CONFIGS[configName].overrides)));
    if (extraOverrides) {
        deepMerge(manifest, extraOverrides);
    }
    return manifest;
};

// hapi 21 only (available from Task 2 on)
const startServer = async (configName, extraOverrides) => {
    const appDir = useFixture(configName),
        Hapi = require('@hapi/hapi'),
        plugin = require(REPO),
        manifest = buildManifest(appDir, configName, extraOverrides),
        server = Hapi.server(plugin.getServerOptions(manifest));
    await server.register({plugin, options: manifest});
    await server.initialize();
    return server;
};

const parseSetCookies = res => {
    const header = res.headers['set-cookie'],
        lines = Array.isArray(header) ? header : (header ? [header] : []);
    return lines.map(line => {
        const parts = line.split(';').map(part => part.trim()),
            nameValue = parts.shift(),
            index = nameValue.indexOf('='),
            attributes = {};
        parts.forEach(part => {
            const i = part.indexOf('=');
            if (i===-1) {
                attributes[part.toLowerCase()] = true;
            }
            else {
                attributes[part.substr(0, i).toLowerCase()] = part.substr(i+1);
            }
        });
        return {name: nameValue.substr(0, index), value: nameValue.substr(index+1), attributes};
    });
};

// builds a Cookie request header from the Set-Cookie headers of earlier responses (later ones win,
// an emptied cookie is dropped)
const cookieHeader = (...responses) => {
    const values = {};
    responses.forEach(res => {
        parseSetCookies(res).forEach(cookie => {
            if (cookie.value==='') {
                delete values[cookie.name];
            }
            else {
                values[cookie.name] = cookie.value;
            }
        });
    });
    return Object.keys(values).map(name => name+'='+values[name]).join('; ');
};

// reads the JSON the fixture views render into <pre id="props"> (React 15 escapes it as HTML)
const readViewProps = html => {
    const match = /<pre id="props">([\s\S]*?)<\/pre>/.exec(html);
    if (!match) {
        return null;
    }
    return JSON.parse(match[1]
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, '\'')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&'));
};

module.exports = {
    REPO,
    FIXTURE_APP,
    useFixture,
    buildManifest,
    startServer,
    parseSetCookies,
    cookieHeader,
    readViewProps
};
```

- [ ] **Step 10: Create the parity request list**

`tests/parity/requests.js`:

```js
'use strict';

// Requests replayed against hapi 16 (recording) and hapi 21 (tests/parity.test.js).
// `cookiesFrom` lists earlier requests (same configuration) whose Set-Cookie headers are sent along.
// Order matters: the plugin caches per view, and `cookie-ttl` changes a module-level ttl, so it is last.

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    PROPS_URL = '/_itsa_server_ajax_/props/aaa111/';

module.exports = {
    plain: [
        {name: 'page-root', url: '/'},
        {name: 'page-root-query', url: '/?x=1&_ts=123'},
        {name: 'page-lang-url', url: '/nl/'},
        {name: 'page-lang-url-no-slash', url: '/nl'},
        {name: 'page-accept-language', url: '/', headers: {'accept-language': 'nl-NL,nl;q=0.9,en;q=0.8'}},
        {name: 'page-phone', url: '/', headers: {'user-agent': IPHONE}},
        {name: 'page-bodydata', url: '/bodydata'},
        {name: 'page-missing-view', url: '/missing-view'},
        {name: 'page-not-found-html', url: '/does/not/exist'},
        {name: 'page-not-found-asset', url: '/does/not/exist.png'},
        {name: 'ajax-props', url: PROPS_URL},
        {name: 'ajax-props-lang', url: '/_itsa_server_ajax_/props/aaa111/nl/'},
        {name: 'ajax-comp', url: '/_itsa_server_ajax_/comp/aaa111/'},
        {name: 'ajax-css', url: '/_itsa_server_ajax_/css/aaa111/'},
        {name: 'ajax-comp-missing-view', url: '/_itsa_server_ajax_/comp/aaa111/missing-view'},
        {name: 'generated-props', url: '/generated-props'},
        {name: 'asset-helper', url: '/asset-helper'},
        {name: 'act-value', url: '/act/value'},
        {name: 'act-value-lang', url: '/nl/act/value'},
        {name: 'act-value-x-lang', url: '/act/value', headers: {'x-lang': 'nl'}},
        {name: 'act-empty', url: '/act/empty'},
        {name: 'act-response', url: '/act/response'},
        {name: 'act-stream', url: '/act/stream'},
        {name: 'act-boom', url: '/act/boom'},
        {name: 'act-throws', url: '/act/throws'},
        {name: 'act-missing', url: '/act/missing'},
        {name: 'act-not-a-function', url: '/act/not-a-function'},
        {name: 'act-options', url: '/act/options'},
        {name: 'act-payload', method: 'POST', url: '/act/payload', payload: {a: 1}},
        {name: 'request-info', url: '/act/request-info?q=1'},
        {name: 'request-info-lang', url: '/nl/act/request-info?q=1'},
        {name: 'request-info-ajax', url: '/_itsa_server_ajax_/props/aaa111/nl/act/request-info'},
        {name: 'favicon', url: '/favicon.ico'},
        {name: 'asset-unversioned', url: '/assets/hello.txt'},
        {name: 'asset-versioned', url: '/assets/1.0.0/hello.txt'},
        {name: 'asset-deep', url: '/assets/1.0.0/sub/deep.txt'},
        {name: 'asset-private', url: '/assets-private/1.0.0/secret.txt'},
        {name: 'asset-local', url: '/assets/local/js/aaa111.js'},
        {name: 'asset-external', url: '/assets/_itsa_server_external_modules/react/x.js'},
        {name: 'serviceworker-disabled', url: '/_itsa_server_serviceworker.js'}
    ],
    cookies: [
        {name: 'cookie-define', url: PROPS_URL, headers: {'x-cookie': 'itsa-props', 'x-action': 'define', 'x-cookieprops': '{"color":"blue","size":3}'}},
        {name: 'cookie-read-after-define', url: '/act/cookies', cookiesFrom: ['cookie-define']},
        {name: 'cookie-set', url: PROPS_URL, headers: {'x-cookie': 'itsa-props', 'x-action': 'set', 'x-cookieprops': '{"size":4}'}, cookiesFrom: ['cookie-define']},
        {name: 'cookie-read-after-set', url: '/act/cookies', cookiesFrom: ['cookie-define', 'cookie-set']},
        {name: 'cookie-delete', url: PROPS_URL, headers: {'x-cookie': 'itsa-props', 'x-action': 'delete', 'x-key': 'color'}, cookiesFrom: ['cookie-define', 'cookie-set']},
        {name: 'cookie-read-after-delete', url: '/act/cookies', cookiesFrom: ['cookie-define', 'cookie-set', 'cookie-delete']},
        {name: 'cookie-bodydata-define', url: PROPS_URL, headers: {'x-cookie': 'itsa-bodydata', 'x-action': 'define', 'x-cookieprops': '{"zoom":"2"}'}},
        {name: 'page-with-bodydata-cookie', url: '/', cookiesFrom: ['cookie-bodydata-define']},
        {name: 'page-with-bodydata-cookie-again', url: '/', cookiesFrom: ['cookie-bodydata-define']},
        {name: 'cookie-notexposed-action', url: '/act/set-notexposed'},
        {name: 'cookie-read-notexposed', url: '/act/cookies', cookiesFrom: ['cookie-notexposed-action']},
        {name: 'globalstate-cookie', url: '/act/cookies', headers: {cookie: 'globalstate='+encodeURIComponent('{"a":1}')}},
        {name: 'ajax-props-refresh', url: PROPS_URL, cookiesFrom: ['cookie-define']},
        {name: 'cookie-remove', url: PROPS_URL, headers: {'x-cookie': 'itsa-props', 'x-action': 'remove'}, cookiesFrom: ['cookie-define']},
        {name: 'cookie-ttl', url: PROPS_URL, headers: {'x-cookie': 'itsa-props', 'x-action': 'ttl', 'x-ms': '600'}, cookiesFrom: ['cookie-define']}
    ],
    auth: [
        {name: 'auth-public', url: '/public'},
        {name: 'auth-private-anonymous', url: '/private'},
        {name: 'auth-private-anonymous-ajax', url: '/_itsa_server_ajax_/props/eee555/private'},
        {name: 'auth-legacy-config-anonymous', url: '/legacy-config-private'},
        {name: 'auth-client-routes', url: '/_itsa_server_ajax_/props/aaa111/public'},
        {name: 'auth-login-user', method: 'POST', url: '/login', payload: {scope: 'user'}},
        {name: 'auth-private-user', url: '/private', cookiesFrom: ['auth-login-user']},
        {name: 'auth-private-user-again', url: '/private', cookiesFrom: ['auth-login-user']},
        {name: 'auth-admin-user', url: '/admin', cookiesFrom: ['auth-login-user']},
        {name: 'auth-login-blocked', method: 'POST', url: '/login', payload: {scope: 'user', blocked: true}},
        {name: 'auth-private-blocked', url: '/private', cookiesFrom: ['auth-login-blocked']},
        {name: 'auth-logout', method: 'POST', url: '/logout', cookiesFrom: ['auth-login-user']},
        {name: 'auth-validate-logout', url: '/private?logout=toolkit', cookiesFrom: ['auth-login-user']},
        {name: 'auth-serviceworker-init', url: '/private', headers: {'x-itsa-serviceworker-init': 'true'}}
    ]
};
```

- [ ] **Step 11: Create the response normalizer**

`tests/parity/normalize.js`:

```js
'use strict';

const crypto = require('crypto');

// props that legitimately differ per run
const VOLATILE_APP_PROPS = ['serverStartup'];

const sortKeys = value => {
    if (Array.isArray(value)) {
        return value.map(sortKeys);
    }
    if (value && (typeof value==='object')) {
        return Object.keys(value).sort().reduce((result, key) => {
            result[key] = sortKeys(value[key]);
            return result;
        }, {});
    }
    return value;
};

const normalizeBody = (payload, contentType) => {
    let text = payload,
        parsed;
    if (contentType && (contentType.indexOf('application/json')!==-1)) {
        try {
            parsed = JSON.parse(payload);
            if (parsed && parsed.__appProps) {
                VOLATILE_APP_PROPS.forEach(key => {
                    delete parsed.__appProps[key];
                });
            }
            text = JSON.stringify(sortKeys(parsed));
        }
        catch (err) {
            text = payload;
        }
    }
    return {
        sha256: crypto.createHash('sha256').update(text).digest('hex'),
        preview: text.slice(0, 120)
    };
};

// cookie values are encrypted (random per run) and Expires is time based: compare everything else.
// SameSite is recorded separately so the parity test can check it on its own (spec §7.1).
const normalizeCookies = setCookie => {
    const lines = Array.isArray(setCookie) ? setCookie : (setCookie ? [setCookie] : []);
    return lines.map(line => {
        const parts = line.split(';').map(part => part.trim()),
            nameValue = parts.shift(),
            index = nameValue.indexOf('='),
            sameSitePart = parts.find(part => /^samesite=/i.test(part));
        return {
            name: nameValue.substr(0, index),
            empty: (nameValue.substr(index+1)===''),
            attributes: parts
                .filter(part => !/^(expires|samesite)=/i.test(part))
                .map(part => part.toLowerCase())
                .sort(),
            sameSite: sameSitePart ? sameSitePart.split('=')[1].toLowerCase() : null
        };
    }).sort((a, b) => ((a.name<b.name) ? -1 : ((a.name>b.name) ? 1 : 0)));
};

const normalizeResponse = res => ({
    status: res.statusCode,
    contentType: res.headers['content-type'] || null,
    noAuth: res.headers['x-noauth'] || null,
    etag: res.headers.etag || null,
    cookies: normalizeCookies(res.headers['set-cookie']),
    body: normalizeBody(res.payload, res.headers['content-type'])
});

module.exports = {
    normalizeResponse
};
```

- [ ] **Step 12: Create the parity runner**

`tests/parity/runner.js`:

```js
'use strict';

// usage: node tests/parity/runner.js <16|21> <configName> <appDir> <outFile>
// Starts ONE fixture configuration on hapi 16 or hapi 21 in this process, replays its parity
// requests and writes the normalized records to <outFile> (stdout is left to the plugin's logging).

const fs = require('fs'),
    path = require('path'),
    fixture = require('../helpers/fixture'),
    REQUESTS = require('./requests'),
    normalizeResponse = require('./normalize').normalizeResponse,
    flavor = process.argv[2],
    configName = process.argv[3],
    appDir = path.resolve(process.argv[4]),
    outFile = path.resolve(process.argv[5]);

const createServer16 = async manifest => {
    const Hapi = require(path.join(fixture.REPO, 'node_modules', 'hapi')),
        plugin = require(fixture.REPO),
        server = new Hapi.Server();
    await new Promise((resolve, reject) => {
        server.register({register: plugin, options: manifest}, err => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
    return server;
};

const createServer21 = async manifest => {
    const Hapi = require('@hapi/hapi'),
        plugin = require(fixture.REPO),
        server = Hapi.server(plugin.getServerOptions(manifest));
    await server.register({plugin, options: manifest});
    await server.initialize();
    return server;
};

const buildCookieHeader = (jar, names, ownCookie) => {
    const values = {},
        parts = [];
    (names || []).forEach(name => {
        (jar[name] || []).forEach(line => {
            const nameValue = line.split(';')[0],
                index = nameValue.indexOf('='),
                cookieName = nameValue.substr(0, index),
                value = nameValue.substr(index+1);
            if (value==='') {
                delete values[cookieName];
            }
            else {
                values[cookieName] = value;
            }
        });
    });
    if (ownCookie) {
        parts.push(ownCookie);
    }
    Object.keys(values).forEach(name => {
        parts.push(name+'='+values[name]);
    });
    return parts.join('; ');
};

const run = async () => {
    const results = {},
        jar = {};
    let manifest, server;
    fixture.useFixture(configName, appDir);
    manifest = fixture.buildManifest(appDir, configName);
    server = (flavor==='16') ? await createServer16(manifest) : await createServer21(manifest);
    for (const spec of REQUESTS[configName]) {
        const headers = Object.assign({}, spec.headers),
            cookie = buildCookieHeader(jar, spec.cookiesFrom, headers.cookie);
        let res, setCookie;
        if (cookie) {
            headers.cookie = cookie;
        }
        res = await server.inject({method: spec.method || 'GET', url: spec.url, headers, payload: spec.payload});
        setCookie = res.headers['set-cookie'];
        jar[spec.name] = Array.isArray(setCookie) ? setCookie : (setCookie ? [setCookie] : []);
        results[spec.name] = normalizeResponse(res);
    }
    fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
};

run().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
```

- [ ] **Step 13: Create the one-off recorder**

`tests/parity/record-hapi16.js`:

```js
'use strict';

// One-off, run BEFORE lib/ is migrated:  node tests/parity/record-hapi16.js
// Copies the fixture app, overlays the hapi 16 (`reply` style) files, runs every configuration on the
// hapi 16 plugin in its own process and writes tests/fixtures/parity-hapi16.json.
// The copy lives inside the repo so `react` and `boom` resolve from the repo's node_modules.

const fs = require('fs-extra'),
    path = require('path'),
    execFileSync = require('child_process').execFileSync,
    REPO = path.resolve(__dirname, '..', '..'),
    APP = path.join(REPO, 'tests', 'fixtures', 'app'),
    OVERLAY = path.join(REPO, 'tests', 'fixtures', 'app-hapi16'),
    TMP_APP = path.join(REPO, 'tests', 'fixtures', '.tmp-app-hapi16'),
    OUT = path.join(REPO, 'tests', 'fixtures', 'parity-hapi16.json'),
    CONFIG_NAMES = Object.keys(require('../helpers/configs'));

const snapshot = {};

fs.removeSync(TMP_APP);
fs.copySync(APP, TMP_APP, {filter: src => (path.basename(src)!=='node_modules')});
fs.copySync(OVERLAY, TMP_APP);

CONFIG_NAMES.forEach(configName => {
    const outFile = path.join(TMP_APP, 'result-'+configName+'.json');
    execFileSync(process.execPath, [path.join(__dirname, 'runner.js'), '16', configName, TMP_APP, outFile], {stdio: 'inherit'});
    snapshot[configName] = fs.readJsonSync(outFile);
});

fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2)+'\n');
fs.removeSync(TMP_APP);
console.log('recorded', OUT);
```

- [ ] **Step 14: Record the snapshot**

Run: `node tests/parity/record-hapi16.js`
Expected: ends with `recorded .../tests/fixtures/parity-hapi16.json`, exit code 0. Plugin warnings on stderr (missing models such as `src/models/not-found.js`) are normal.

- [ ] **Step 15: Check the snapshot matches the known hapi 16 behaviour**

Run:

```bash
node -e "
const s = require('./tests/fixtures/parity-hapi16.json');
const expect = {
  plain: {'page-root': [200, null], 'page-lang-url': [200, null], 'page-missing-view': [404, null], 'page-not-found-html': [200, null],
    'page-not-found-asset': [404, null], 'ajax-props': [200, null], 'ajax-comp': [200, null], 'ajax-css': [200, null],
    'ajax-comp-missing-view': [404, null], 'generated-props': [200, null], 'act-value': [200, null], 'act-empty': [200, null],
    'act-response': [201, null], 'act-stream': [200, null], 'act-boom': [500, null], 'act-throws': [500, null],
    'act-missing': [500, null], 'act-not-a-function': [500, null], 'favicon': [200, null], 'asset-private': [200, null],
    'serviceworker-disabled': [200, null]},
  cookies: {'cookie-define': [200, null], 'cookie-read-after-set': [200, null], 'cookie-ttl': [200, null]},
  auth: {'auth-public': [200, null], 'auth-private-anonymous': [200, 'true'], 'auth-legacy-config-anonymous': [200, 'true'],
    'auth-login-user': [200, null], 'auth-private-user': [200, null], 'auth-admin-user': [200, 'true'],
    'auth-private-blocked': [200, 'true'], 'auth-serviceworker-init': [200, null]}
};
let bad = 0;
for (const c of Object.keys(expect)) for (const n of Object.keys(expect[c])) {
  const r = s[c][n], e = expect[c][n];
  if (!r || r.status !== e[0] || r.noAuth !== e[1]) { bad++; console.log('MISMATCH', c, n, r && r.status, r && r.noAuth, 'expected', e); }
}
const ttl = s.cookies['cookie-ttl'].cookies.find(x => x.name === 'itsa-props');
if (!ttl || !ttl.attributes.includes('max-age=0')) { bad++; console.log('MISMATCH cookie-ttl should carry max-age=0 on hapi 16', ttl); }
if (!s.cookies['cookie-define'].cookies.some(x => x.name === 'itsa-props' && !x.empty)) { bad++; console.log('MISMATCH cookie-define sets no itsa-props'); }
if (!s.auth['auth-login-user'].cookies.some(x => x.name === 'itsa-id' && !x.empty)) { bad++; console.log('MISMATCH login sets no itsa-id'); }
console.log(bad ? bad + ' mismatches' : 'snapshot OK');
"
```

Expected: `snapshot OK`. On a mismatch, the fixture (not `lib/`) is wrong: fix the fixture file and re-run Steps 14–15. If you believe the hapi 16 code itself behaves differently from this table, stop and report it instead of changing the table.

- [ ] **Step 16: Commit**

Add `- Task 1 — this commit — fixture app, parity tooling, hapi 16 snapshot recorded` to the ledger's Progress section, then:

```bash
git add .gitignore tests docs/superpowers/plans/2026-09-24-hapi21-migration-ledger.md
git status --short   # must show no lib/ changes and no tests/fixtures/app/node_modules
git commit -m "ADDED: fixture app, parity tooling and hapi 16 parity snapshot

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Package, plugin entry and startup on hapi 21

After this task the plugin registers on hapi 21. Request handling is ported in later tasks (requests may still fail here).

**Files:**
- Modify: `package.json`
- Modify (full rewrite): `lib/hapi-plugin/plugin.js`
- Rename + modify: `lib/hapi-plugin/helpers/extend-reply.js` → `lib/hapi-plugin/helpers/extend-toolkit.js`
- Modify: `lib/hapi-plugin/helpers/apply-client-routes.js`
- Modify: `lib/hapi-plugin/helpers/middleware.js`, `lib/hapi-plugin/helpers/console-debug.js`, `lib/hapi-plugin/helpers/apply-server-routes.js` (registration-time lines only)
- Modify: `lib/socketio/socketserver.js` (require line only)
- Test: `tests/startup.test.js`, `tests/startup-broken.test.js`

**Interfaces:**
- Consumes: `tests/helpers/fixture.js` (Task 1).
- Produces:
  - `require('itsa-react-server')` → `{name: 'itsa-react-server', version, register(server, manifest), getServerOptions(manifest) → {host, port}}`.
  - `server.manifest` (decorated) → the environment-merged manifest (`envName`, `packageVersion`, `defaultLanguage`, …).
  - `extend-toolkit.js` exports `extend(server, options, appConfig, viewComponentCommon, viewComponentNrs, appTitles, clientRoutes, startupTime)`.

- [ ] **Step 1: Write the failing startup tests**

`tests/startup.test.js`:

```js
'use strict';

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture'),
    rejections = [];

// Review Focus 1: route discovery must not leave rejected promises behind (fatal on Node 24)
process.on('unhandledRejection', reason => {
    rejections.push(reason);
});

let server;

before(async () => {
    server = await fixture.startServer('plain');
    await new Promise(resolve => setImmediate(resolve));
});

test('registers on hapi 21 under its own name and version', () => {
    const registration = server.registrations['itsa-react-server'];
    assert.ok(registration);
    assert.strictEqual(registration.version, require('../package.json').version);
});

test('decorates server.manifest with the environment-merged manifest', () => {
    assert.strictEqual(server.manifest.envName, 'test');
    assert.strictEqual(server.manifest.port, 3999);
    assert.strictEqual(server.manifest.host, '127.0.0.1');
    assert.strictEqual(server.manifest.packageVersion, '1.0.0');
    assert.strictEqual(server.manifest.defaultLanguage, 'en');
});

test('registers inert and vision', () => {
    assert.ok(server.registrations['@hapi/inert']);
    assert.ok(server.registrations['@hapi/vision']);
});

test('client-route discovery leaves no unhandled rejections (async handlers)', () => {
    assert.deepStrictEqual(rejections, []);
});

test('getServerOptions resolves host and port for NODE_ENV', () => {
    const plugin = require('..'),
        manifest = fixture.buildManifest(fixture.FIXTURE_APP, 'plain'),
        previous = process.env.NODE_ENV;
    try {
        process.env.NODE_ENV = 'test';
        assert.deepStrictEqual(plugin.getServerOptions(manifest), {host: '127.0.0.1', port: 3999});
        process.env.NODE_ENV = 'production';
        assert.deepStrictEqual(plugin.getServerOptions(manifest), {host: '0.0.0.0', port: 8080});
        delete process.env.NODE_ENV; // 'local': no environment entry, so the base values
        assert.deepStrictEqual(plugin.getServerOptions(manifest), {host: '0.0.0.0', port: 3001});
    }
    finally {
        process.env.NODE_ENV = previous;
    }
});

test('does not register inert and vision twice when the app already did', async () => {
    const Hapi = require('@hapi/hapi'),
        plugin = require('..'),
        manifest = fixture.buildManifest(fixture.FIXTURE_APP, 'plain'),
        other = Hapi.server(plugin.getServerOptions(manifest));
    await other.register([require('@hapi/inert'), require('@hapi/vision')]);
    await other.register({plugin, options: manifest});
    assert.ok(other.registrations['itsa-react-server']);
});
```

`tests/startup-broken.test.js`:

```js
'use strict';

const {test} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture');

test('register rejects when src/routes.js cannot be loaded (spec §6.1)', async () => {
    process.env.ITSA_FIXTURE_BROKEN_ROUTES = 'true';
    await assert.rejects(fixture.startServer('plain'), /fixture: broken routes/);
});
```

- [ ] **Step 2: Update `package.json` and install**

In `package.json`:
- `"version"` stays `17.0.0` for now (bumped in Task 10).
- `"engines"`: `{"node": ">=14"}`.
- In `"dependencies"`: remove `"boom"`, `"hoek"`, `"inert"`, `"vision"`; add (keep alphabetical order, `@` entries sort first):
  `"@hapi/boom": "^10.0.1"`, `"@hapi/hoek": "^11.0.7"`, `"@hapi/inert": "^7.1.0"`, `"@hapi/vision": "^7.0.3"`.
- `"peerDependencies"`: `{"@hapi/hapi": "^21"}`.
- Add `"devDependencies": {"@hapi/hapi": "^21.4.10"}` after `"dependencies"`.
- `"scripts"`: remove `"pretest"`; set `"test": "node --test --test-force-exit \"tests/*.test.js\""`; keep `"lint"` unchanged.

Run: `npm install`
Expected: completes; `npm ls @hapi/hapi @hapi/inert @hapi/vision @hapi/boom` shows 21.x / 7.x / 7.x / 10.x; `ls node_modules/hapi` fails (hapi 16 was only an auto-installed peer). If `node_modules/hapi` is still there, run `npm prune` and check again.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test --test-force-exit tests/startup.test.js tests/startup-broken.test.js`
Expected: FAIL — the plugin cannot load (`Cannot find module 'vision'` / `'hapi'`) or cannot register.

- [ ] **Step 4: Rewrite `lib/hapi-plugin/plugin.js`**

Keep the existing copyright header comment. Replace everything after it with:

```js
/* eslint no-empty: 0*/
/* eslint no-cond-assign: 0*/
'use strict';

// first: enable the server from usging specific browser globals, like `window`, `document`, `navigator` etc:
require('jsdom-global')();
require('itsa-jsext');

if (typeof global.requestAnimationFrame!=='function') {
    global.requestAnimationFrame = function(){}; // prevent React serverside from error messaging
}
if (typeof global.cancelAnimationFrame!=='function') {
    global.cancelAnimationFrame = function(){}; // prevent React serverside from error messaging
}

const reload = require('require-reload')(require), // see https://github.com/fastest963/require-reload
    cwd = process.cwd(),
    Vision = require('@hapi/vision'),
    Inert = require('@hapi/inert'),
    pkg = require('../../package.json'),
    SocketServer = require('../socketio/socketserver'),
    cdnCleanup = require('../cdn-cleanup'),
    consoleDebug = require('./helpers/console-debug'), // create console.debug
    applyTitles = require('./helpers/apply-titles'),
    applyClientRoutes = require('./helpers/apply-client-routes'),
    middleware = require('./helpers/middleware'),
    serviceWorkerCacheList = require('./helpers/serviceworker-cache-list'),
    applyServerRoutes = require('./helpers/apply-server-routes'),
    getManifest = require('./helpers/get-manifest'),
    extendToolkit = require('./helpers/extend-toolkit'),
    defaultLanguage = require('./helpers/default-language');

let clientRoutes = {
        desktop: [],
        tablet: [],
        phone: []
    },
    VIEW_COMPONENT_NRS = {},
    VIEW_COMPONENT_COMMON = {},
    APP_TITELS = {},
    serviceWorkerCacheListViews = [];

const getEnvironment = () => process.env.NODE_ENV || 'local';

const applyBuildStats = async () => {
    const data = reload(cwd+'/build/build-stats.json');
    data.forEach(record => {
        if (record.name) {
            VIEW_COMPONENT_NRS[record.name] = {
                componentId: record.componentId,
                requireId: record.requireId,
                hash: record.hash,
                cssfile: record.cssfile
            };
        }
        else if (record.isCommon) {
            VIEW_COMPONENT_COMMON = {
                hash: record.hash,
                cssfile: record.cssfile
            };
        }
    });
};

const startSocketServer = (appConfig, startupTime) => {
    const localEnvironment = (getEnvironment()==='local');
    let host, port;
    if (appConfig.socketServer && appConfig.socketServer.enabled) {
        // setup custom socketio:
        host = appConfig.socketServer.host || appConfig.host || '0.0.0.0';
        port = appConfig.socketServer.port;
        if (localEnvironment || appConfig.debug) {
            console.log('starting socketserver on', host+':'+port);
        }
        SocketServer.start({
            host,
            port,
            serverStartupTime: startupTime,
            sequentialClientUpdate: appConfig.sequentialClientUpdate
        });
    }
};

// the host and port the app's hapi server should listen on, for the current NODE_ENV:
// hapi 21 needs them when the server is created, before this plugin is registered
const getServerOptions = manifest => {
    const appConfig = getManifest.generate(getEnvironment(), manifest);
    return {
        host: appConfig.host,
        port: appConfig.port
    };
};

// errors are not caught: `await server.register()` rejects, so a half-configured app never serves
const register = async (server, manifest) => {
    const startupTime = Date.now(); // needed to inform clients that the server is restarted, by: this.props.__serverStartup
    let appConfig, cacheList;

    if (!server.registrations['@hapi/inert']) {
        await server.register(Inert);
    }
    if (!server.registrations['@hapi/vision']) {
        await server.register(Vision);
    }

    appConfig = getManifest.generate(getEnvironment(), manifest);
    server.decorate('server', 'manifest', appConfig);
    consoleDebug.create(appConfig.debug);
    await defaultLanguage.generate(appConfig);
    await applyBuildStats();
    await applyTitles.generate(APP_TITELS, appConfig.languages);
    await applyClientRoutes.generate(clientRoutes, VIEW_COMPONENT_NRS, APP_TITELS, serviceWorkerCacheListViews, appConfig);
    await extendToolkit.extend(server, manifest, appConfig, VIEW_COMPONENT_COMMON, VIEW_COMPONENT_NRS, APP_TITELS, clientRoutes, startupTime);
    cacheList = await serviceWorkerCacheList.generate(serviceWorkerCacheListViews, appConfig);
    await middleware.generate(server, cacheList, appConfig);
    await applyServerRoutes.generate(server, cacheList, appConfig, startupTime);
    if (appConfig.debug) {
        consoleDebug.logRequests(server);
    }
    startSocketServer(appConfig, startupTime);
    cdnCleanup.cleanup();
};

module.exports = {
    name: 'itsa-react-server',
    version: pkg.version,
    register,
    getServerOptions
};
```

- [ ] **Step 5: Rename `extend-reply.js` and make it register on hapi 21**

Run: `git mv lib/hapi-plugin/helpers/extend-reply.js lib/hapi-plugin/helpers/extend-toolkit.js`

In `lib/hapi-plugin/helpers/extend-toolkit.js` make exactly these changes (the decoration bodies are ported in Tasks 3–5):

1. In `extend(...)`, replace

```js
    const buildPrefix = '/build/',
        serverConnection = server.root,
        extraEngines = options.engines;
    let views;

    serverConnection.connection({
        host: appConfig.host,
        port: appConfig.port
    });
```

with

```js
    const buildPrefix = '/build/',
        extraEngines = options.engines;
    let views;
```

2. Replace `serverConnection.views(views);` with `server.views(views);`
3. Replace every `server.decorate('reply', ` with `server.decorate('toolkit', ` (6 occurrences).

- [ ] **Step 6: Make client-route discovery read `options`/`config` and survive async handlers**

In `lib/hapi-plugin/helpers/apply-client-routes.js`, replace the block from `const fakereply = {` through the end of `getRouteReactView` with:

```js
    // stand-in for hapi's toolkit `h`: records which view a route's handler renders
    const fakeToolkit = {
        reactview: function(view) {
            this.view = view;
        }
    };
    // hapi 21 still accepts the legacy `config` key as an alias of `options`
    const getRouteOptions = route => route.options || route.config;
    const getRouteReactView = route => {
        let subMethodGet, handler, routeOptions, result;
        if (Array.isArray(route.method)) {
            subMethodGet = route.method.find(method => (method.toUpperCase()==='GET'));
            route.method = subMethodGet ? 'GET' : 'UNDEFINED';
        }
        if (route.method.toUpperCase()!=='GET') {
            return;
        }
        routeOptions = getRouteOptions(route);
        if (typeof route.handler==='function') {
            handler = route.handler;
        }
        else if (routeOptions && (typeof routeOptions.handler==='function')) {
            handler = routeOptions.handler;
        }
        else {
            return;
        }
        // now fake the handler. If an error occurs, then there is no valid reactview-route
        delete fakeToolkit.view;
        try {
            result = handler({params:{}, query: {}, payload: {}}, fakeToolkit);
            if (result && (typeof result.then==='function')) {
                // an async handler rejects when it uses more than the stand-in offers:
                // swallow it, an unhandled rejection would stop the process
                result.then(null, () => {});
            }
            return {
                view: fakeToolkit.view
            };
        }
        catch (err) {}
    };
```

and in the `routes.forEach(...)` body replace

```js
                privateView = !!(route.config && route.config.auth);
```

with

```js
                privateView = !!(getRouteOptions(route) && getRouteOptions(route).auth);
```

- [ ] **Step 7: Replace `server.root` in the registration code**

- `lib/hapi-plugin/helpers/middleware.js`: replace `var serverConnection = server.root,` with `var serverConnection = server,`.
- `lib/hapi-plugin/helpers/console-debug.js`: replace `server.root.ext('onRequest'` with `server.ext('onRequest'`.
- `lib/hapi-plugin/helpers/apply-server-routes.js`:
  - replace `serverConnection = server.root,` with `serverConnection = server,`;
  - replace `server.root.ext('onPreResponse'` with `server.ext('onPreResponse'`;
  - delete the whole `serverConnection.activateRoutes = function() { … };` block and the final `serverConnection.activateRoutes();` call, and put `serverConnection.route(routes);` where that final call was (errors now propagate, spec §6.1).
- `lib/socketio/socketserver.js`: replace `Hapi = require('hapi'),` with `Hapi = require('@hapi/hapi'),`.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `node --test --test-force-exit tests/startup.test.js tests/startup-broken.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 9: Lint gate and commit**

Run `npx eslint -f unix lib/hapi-plugin/plugin.js lib/hapi-plugin/helpers/extend-toolkit.js lib/hapi-plugin/helpers/apply-client-routes.js lib/hapi-plugin/helpers/middleware.js lib/hapi-plugin/helpers/console-debug.js lib/hapi-plugin/helpers/apply-server-routes.js lib/socketio/socketserver.js` and compare per-file counts with the ledger baseline (`extend-toolkit.js` against `extend-reply.js`); fix any file that went up.

Add the ledger line, then:

```bash
git add package.json package-lock.json lib tests docs/superpowers/plans/2026-09-24-hapi21-migration-ledger.md
git commit -m "CHANGED: plugin registers on hapi 21 (@hapi/hapi, inert 7, vision 7)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2b: React 16 (added 2026-09-25, spec §11)

A plain `npm install` fails (ERESOLVE): `itsa-react-globalstate` requires `react >= 16`, the package pins React 15. Task 2 therefore installed with `--legacy-peer-deps`. This task steps React up one major version, regenerates the lockfile with a plain install, and proves server rendering is unchanged.

**Files:**
- Create: `tests/parity/render-samples.js`, `tests/parity/record-react15-render.js`, `tests/fixtures/react15-render.json` (generated), `tests/react-render.test.js`
- Modify: `package.json`, `package-lock.json`, `lib/hapi-plugin/helpers/jsx-view.js`, `lib/default-manifest.json`

**Interfaces:**
- Consumes: fixture views `tests/fixtures/app/build/view_components/*.js` and `tests/helpers/fixture.js` (Task 1).
- Produces: `jsx-view.js` keeps its export `{View: {compile(template, compileOpts) → (context, renderOpts) → html}, clearCache()}`; `renderOpts.filename` is the view file.

- [ ] **Step 1: Create the render samples**

`tests/parity/render-samples.js`:

```js
'use strict';

// Props rendered through lib/hapi-plugin/helpers/jsx-view.js on React 15 (recorded) and React 16 (test).
// `escaping` holds every character React escapes, so an escaping change shows up.

module.exports = {
    index: {
        view: 'index',
        props: {
            __appProps: {view: 'index', lang: 'en', langprefix: '', locales: ['en'], path: '/', uri: '/?x=1', device: 'desktop', title: 'Home'},
            __bodyDataAttr: {'data-theme': 'dark'},
            authentication: true,
            fromModel: 42,
            general: 'yes'
        }
    },
    escaping: {
        view: 'login',
        props: {
            __appProps: {view: 'login', lang: 'nl', title: 'Log <in> & "go" \'now\''},
            __bodyDataAttr: {},
            authentication: false,
            authenticationMsg: 'Tom\'s <b>"quoted"</b> & more'
        }
    }
};
```

- [ ] **Step 2: Record the React 15 rendering (before any upgrade)**

`tests/parity/record-react15-render.js`:

```js
'use strict';

// One-off, run while React 15 is installed:  node tests/parity/record-react15-render.js
// Renders the samples through jsx-view and writes tests/fixtures/react15-render.json.

const fs = require('fs'),
    path = require('path'),
    fixture = require('../helpers/fixture'),
    SAMPLES = require('./render-samples'),
    View = require(path.join(fixture.REPO, 'lib', 'hapi-plugin', 'helpers', 'jsx-view')).View,
    OUT = path.join(fixture.REPO, 'tests', 'fixtures', 'react15-render.json'),
    rendered = {};

console.log('react', require('react/package.json').version);
Object.keys(SAMPLES).forEach(name => {
    const filename = path.join(fixture.FIXTURE_APP, 'build', 'view_components', SAMPLES[name].view+'.js');
    rendered[name] = View.compile('', {})(SAMPLES[name].props, {filename});
});
fs.writeFileSync(OUT, JSON.stringify(rendered, null, 2)+'\n');
console.log('recorded', OUT);
```

Run: `node tests/parity/record-react15-render.js`
Expected: prints `react 15.6.2` and `recorded .../tests/fixtures/react15-render.json`. Open the JSON: `index` starts with `<!DOCTYPE html><html><body><h1>index</h1>`; `escaping` contains `&lt;` / `&amp;` / `&quot;` / `&#x27;`.

- [ ] **Step 3: Write the rendering test**

`tests/react-render.test.js`:

```js
'use strict';

const {test} = require('node:test'),
    assert = require('node:assert'),
    path = require('path'),
    fixture = require('./helpers/fixture'),
    SAMPLES = require('./parity/render-samples'),
    recorded = require('./fixtures/react15-render.json'),
    View = require(path.join(fixture.REPO, 'lib', 'hapi-plugin', 'helpers', 'jsx-view')).View;

Object.keys(SAMPLES).forEach(name => {
    test('jsx-view renders "'+name+'" exactly as React 15 did', () => {
        const filename = path.join(fixture.FIXTURE_APP, 'build', 'view_components', SAMPLES[name].view+'.js');
        assert.strictEqual(View.compile('', {})(SAMPLES[name].props, {filename}), recorded[name]);
    });
});
```

Run: `node --test --test-force-exit tests/react-render.test.js`
Expected: PASS on React 15 (baseline sanity: the test reproduces the recording).

- [ ] **Step 4: Upgrade React and reinstall without flags**

In `package.json` `dependencies` set `"react": "^16.14.0"` and `"react-dom": "^16.14.0"`.

Run: `npm install` (no `--legacy-peer-deps`, no `--force`).
Expected: completes without ERESOLVE; `npm ls react react-dom` shows 16.14.x and no `invalid`/`UNMET PEER` lines; `npm ls @hapi/hapi` still shows 21.x.

If the install fails because something requires a newer React than 16, change both to the next major (`^17.0.2`, then `^18.3.1`), re-run, and record in the report which package forced it. If it fails for any other reason, stop and report BLOCKED with the full npm error — do not force.

- [ ] **Step 5: Run the rendering test on React 16**

Run: `node --test --test-force-exit tests/react-render.test.js 2>&1 | tee /dev/stderr | grep -c "createFactory"`
Expected: the tests PASS (identical HTML) and the count is **1 or more**: React 16.14 warns that `React.createFactory()` is deprecated (RED for the pristine-output rule). If the count is 0, note that in the report — Step 6 applies anyway (spec §11). If the HTML differs, stop and report it with both outputs — do not re-record the fixture.

- [ ] **Step 6: Replace `React.createFactory` in `jsx-view.js`**

In `lib/hapi-plugin/helpers/jsx-view.js` replace

```js
            if (!VIEW_CACHE[view]) {
                // require(view) will invoke the code and set global.__viewComponent to the Component that the view should have specified
                require(view);
                VIEW_CACHE[view] = React.createFactory(global.__viewComponent);
            }
            output += ReactDOMServer[method](VIEW_CACHE[view](context));
```

with

```js
            if (!VIEW_CACHE[view]) {
                // require(view) will invoke the code and set global.__viewComponent to the Component that the view should have specified
                require(view);
                VIEW_CACHE[view] = global.__viewComponent;
            }
            output += ReactDOMServer[method](React.createElement(VIEW_CACHE[view], context));
```

Run: `node --test --test-force-exit tests/react-render.test.js 2>&1 | grep -c "createFactory"`
Expected: `0`, and the tests PASS.

- [ ] **Step 7: Point the default manifest at React 16's `umd/` files**

In `lib/default-manifest.json`, replace the `"file"` values of the React entries in all three `external-modules` lists:

| list | `react` | `react-dom` | `react-dom/server` |
|---|---|---|---|
| top level (production) | `react/umd/react.production.min.js` | `react-dom/umd/react-dom.production.min.js` | `react-dom/umd/react-dom-server.browser.production.min.js` |
| `environments.local` | `react/umd/react.development.js` | `react-dom/umd/react-dom.development.js` | `react-dom/umd/react-dom-server.browser.development.js` |
| `environments.development` | `react/umd/react.development.js` | `react-dom/umd/react-dom.development.js` | `react-dom/umd/react-dom-server.browser.development.js` |

Leave `"module"` and `"ref"` unchanged.

Run:

```bash
node -e "
const m = require('./lib/default-manifest.json'), fs = require('fs');
const lists = [m['external-modules'], m.environments.local['external-modules'], m.environments.development['external-modules']];
let bad = 0;
lists.forEach(list => list.forEach(e => { if (!fs.existsSync('node_modules/' + e.file)) { bad++; console.log('MISSING', e.file); } }));
console.log(bad ? bad + ' missing' : 'all React files exist');
"
grep -c "react/dist\|react-dom/dist" lib/default-manifest.json
```

Expected: `all React files exist`, then `0`.

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS (startup tests and the rendering test), output without React deprecation warnings.

- [ ] **Step 9: Lint gate and commit**

Lint gate for `jsx-view.js` (baseline in the ledger). Add the ledger line (include the React version that made `npm install` succeed), then:

```bash
git add package.json package-lock.json lib/hapi-plugin/helpers/jsx-view.js lib/default-manifest.json tests docs/superpowers/plans/2026-09-24-hapi21-migration-ledger.md
git commit -m "CHANGED: React 16 (plain npm install works again); jsx-view without createFactory

Co-Authored-By: <the model you are> <noreply@anthropic.com>"
```

---

### Task 3: Request lifecycle — middleware, debug logging, page-not-found hook, actions

**Files:**
- Modify (full rewrite of `generate`): `lib/hapi-plugin/helpers/middleware.js`
- Modify: `lib/hapi-plugin/helpers/console-debug.js`
- Modify (full rewrite): `lib/hapi-plugin/helpers/action-handler.js`
- Modify: `lib/hapi-plugin/helpers/extend-toolkit.js` (the `action` decoration only)
- Modify: `lib/hapi-plugin/helpers/apply-server-routes.js` (the `onPreResponse` hook only)
- Test: `tests/actions.test.js`, `tests/middleware.test.js`, `tests/ddos.test.js`, `tests/debug-logging.test.js`

**Interfaces:**
- Consumes: `fixture.startServer` (Task 1), plugin registration (Task 2).
- Produces: `h.action(name, options) → Promise<value | response | Boom>`; `actionHandler.invoke(action, options, request, h, appConfig)`; requests carry `request.affinity`, `request.language`, `request.locales`, `request.languageSwitch`, header `x-ajaxtype` after `onRequest`.

- [ ] **Step 1: Write the failing tests**

`tests/actions.test.js`:

```js
'use strict';

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture');

let server;

before(async () => {
    server = await fixture.startServer('plain');
});

test('an action returning a value sends it as JSON', async () => {
    const res = await server.inject('/act/value');
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(res.payload), {hello: 'world', language: 'en'});
});

test('an action returning nothing sends {status: "OK"} (route declared with `options:`)', async () => {
    const res = await server.inject('/act/empty');
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(res.payload), {status: 'OK'});
});

test('an action can return h.response() with code and headers (route declared with legacy `config:`)', async () => {
    const res = await server.inject('/act/response');
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.headers['x-custom'], 'yes');
    assert.deepStrictEqual(JSON.parse(res.payload), {created: true});
});

test('an action can return a stream with headers', async () => {
    const res = await server.inject('/act/stream');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload, 'chunk-1,chunk-2');
    assert.strictEqual(res.headers['content-disposition'], 'attachment; filename="data.txt"');
});

test('a thrown Boom error keeps its status (spec §6.2); a 409, because a 404 on an extensionless path becomes the pageNotFoundView page', async () => {
    const res = await server.inject('/act/boom');
    assert.strictEqual(res.statusCode, 409);
    assert.strictEqual(JSON.parse(res.payload).message, 'Project locked');
});

test('a thrown non-Boom error becomes a generic 500', async () => {
    const res = await server.inject('/act/throws');
    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(JSON.parse(res.payload).message, 'An internal server error occurred');
    assert.ok(!res.payload.includes('secret internals'));
});

test('a missing action file becomes a 500', async () => {
    assert.strictEqual((await server.inject('/act/missing')).statusCode, 500);
});

test('an action module that does not export a function becomes a 500', async () => {
    assert.strictEqual((await server.inject('/act/not-a-function')).statusCode, 500);
});

test('an unmigrated action calling h() logs the migration hint', async () => {
    const logged = [],
        original = console.error;
    let res;
    console.error = (...args) => {
        logged.push(args.map(String).join(' '));
    };
    try {
        res = await server.inject('/act/legacy');
    }
    finally {
        console.error = original;
    }
    assert.strictEqual(res.statusCode, 500);
    assert.ok(logged.some(line => line.includes('actions must return a value or h.response(...)')), logged.join('\n'));
});

test('action options and language are passed through', async () => {
    assert.deepStrictEqual(JSON.parse((await server.inject('/act/options')).payload), {options: {inline: true}, language: 'en'});
    assert.strictEqual(JSON.parse((await server.inject({url: '/act/value', headers: {'x-lang': 'nl'}})).payload).language, 'nl');
});

test('a POST payload reaches the action', async () => {
    const res = await server.inject({method: 'POST', url: '/act/payload', payload: {a: 1}});
    assert.deepStrictEqual(JSON.parse(res.payload), {payload: {a: 1}});
});
```

`tests/middleware.test.js`:

```js
'use strict';

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture'),
    IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    IPAD = 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

let server;

const info = async options => JSON.parse((await server.inject(options)).payload);

before(async () => {
    server = await fixture.startServer('plain');
});

test('a language prefix sets the language and is stripped, keeping the query (Review Focus 3)', async () => {
    const result = await info('/nl/act/request-info?q=1');
    assert.strictEqual(result.path, '/act/request-info');
    assert.deepStrictEqual(result.query, {q: '1'});
    assert.strictEqual(result.language, 'nl');
    assert.deepStrictEqual(result.locales, ['nl']);
    assert.strictEqual(result.languageSwitch, true);
});

test('without a prefix, Accept-Language picks a configured language', async () => {
    const result = await info({url: '/act/request-info', headers: {'accept-language': 'nl-NL,nl;q=0.9'}});
    assert.strictEqual(result.language, 'nl');
    assert.deepStrictEqual(result.locales, ['nl-NL']);
    assert.strictEqual(result.languageSwitch, false);
});

test('an unsupported Accept-Language falls back to the default language', async () => {
    const result = await info({url: '/act/request-info', headers: {'accept-language': 'fr-FR'}});
    assert.strictEqual(result.language, 'en');
    assert.deepStrictEqual(result.locales, ['en']);
});

test('the ajax prefix is stripped, sets x-ajaxtype and keeps the query (Review Focus 3)', async () => {
    const result = await info('/_itsa_server_ajax_/props/aaa111/nl/act/request-info?q=2');
    assert.strictEqual(result.path, '/act/request-info');
    assert.strictEqual(result.ajaxtype, 'props');
    assert.strictEqual(result.language, 'nl');
    assert.deepStrictEqual(result.query, {q: '2'});
});

test('device affinity follows the user agent', async () => {
    assert.strictEqual((await info('/act/request-info')).affinity, 'desktop');
    assert.strictEqual((await info({url: '/act/request-info', headers: {'user-agent': IPHONE}})).affinity, 'phone');
    assert.strictEqual((await info({url: '/act/request-info', headers: {'user-agent': IPAD}})).affinity, 'tablet');
});

test('a 404 for a non-page path stays a 404', async () => {
    const res = await server.inject('/does/not/exist.png');
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(JSON.parse(res.payload).error, 'Not Found');
});
```

`tests/ddos.test.js`:

```js
'use strict';

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture');

let server;

before(async () => {
    // limit 3 requests; a long check interval so the table is not reset during the test
    server = await fixture.startServer('plain', {'ddos-prevention': {limit: 3, checkinterval: 60}});
});

test('requests over the ddos limit get the configured status and message', async () => {
    const statuses = [];
    let last;
    for (let i = 0; i<5; i++) {
        last = await server.inject({url: '/act/value', headers: {'user-agent': 'ddos-test-agent'}});
        statuses.push(last.statusCode);
    }
    assert.deepStrictEqual(statuses, [200, 200, 200, 429, 429]);
    assert.strictEqual(last.payload, 'Error');
});
```

`tests/debug-logging.test.js`:

```js
'use strict';

const {test} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture');

test('debug mode logs each request and still serves it (Review Focus 2)', async () => {
    const server = await fixture.startServer('plain', {debug: true}),
        lines = [],
        original = console.log;
    let res;
    console.log = (...args) => {
        lines.push(args.map(arg => ((typeof arg==='string') ? arg : JSON.stringify(arg))).join(' '));
    };
    try {
        res = await server.inject('/act/value');
    }
    finally {
        console.log = original;
    }
    assert.strictEqual(res.statusCode, 200);
    assert.ok(lines.some(line => line.includes('GET') && line.includes('/act/value')), lines.join('\n'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test --test-force-exit tests/actions.test.js tests/middleware.test.js tests/ddos.test.js tests/debug-logging.test.js`
Expected: FAIL — requests answer 500 (`reply.continue is not a function`).

- [ ] **Step 3: Rewrite the middleware**

In `lib/hapi-plugin/helpers/middleware.js` replace the whole `generate` function with:

```js
const generate = async (server, cacheList, appConfig) => {
    const itsaAjaxRegexp = new RegExp('^/_itsa_server_ajax_/(comp|css|props)/\\w+(/|$)');
    let ddos;

    ddos = new Ddos(appConfig['ddos-prevention'].itsa_merge({
        serviceWorkerItemCount: cacheList.length,
        isDevelopment: (appConfig.envName!=='production')
    }, {force: true}));

    server.ext('onRequest', (request, h) => {
        // first, check DDOS attack:
        const ddosResponse = ddos.handle(request);
        if (ddosResponse.ok) {
            return h.continue;
        }
        // else
        return h.response(ddosResponse.message).code(ddosResponse.statusCode).takeover();
    });

    server.ext('onRequest', (request, h) => {
        let path, secondSlash, possibleLang, acceptLanguage, acceptLanguages, qualityDivider, match;

        // setting middleware for defining :
        request.affinity = ((appConfig.device==='phone') || (appConfig.device==='tablet')) ?
            appConfig.device :
            Contextualizer.getDevice(request.headers['user-agent']);

        path = request.path;
        // check if the path equals an SPA ajax request, in which case we will remove the leading information from the path:
        match = path.match(itsaAjaxRegexp);
        if (match) {
            request.headers['x-ajaxtype'] = match[1];
            path = '/'+path.substr(match[0].length);
        }
        // setting middleware for defining language:
        secondSlash = path.indexOf('/', 1);
        possibleLang = (secondSlash!==-1) ? path.substring(1, secondSlash) : path.substring(1);
        if (appConfig.languages[possibleLang]) {
            request.language = possibleLang;
            request.locales = [possibleLang];
            path = (secondSlash!==-1) ? path.substr(secondSlash) : '/';
            // set languageSwitch whenever the language differs from the clients default
            request.languageSwitch = true;
        }
        else {
            acceptLanguage = request.headers['accept-language'];
            acceptLanguages = acceptLanguage && acceptLanguage.split(',');
            // no language forced by url --> check the language from the request
            acceptLanguages && acceptLanguages.some(function(lang) {
                lang = lang.trim();
                qualityDivider = acceptLanguage.indexOf(';');
                if (qualityDivider>-1) {
                    lang = lang.substr(0, qualityDivider);
                }
                possibleLang = lang.split('-')[0];
                if (appConfig.languages[possibleLang]) {
                    request.language = possibleLang;
                    request.locales = [lang];
                }
                return request.language;
            });
            request.language || (request.language=appConfig.defaultLanguage);
            request.locales || (request.locales=[appConfig.defaultLanguage]);
        }
        // hapi 21: the path is read-only, rewrite the url instead (keeps the query)
        if (path!==request.path) {
            request.setUrl(path+request.url.search);
        }
        return h.continue;
    });
};
```

- [ ] **Step 4: Port the debug logger**

In `lib/hapi-plugin/helpers/console-debug.js` change the `logRequests` ext signature from `function(request, reply)` to `function(request, h)` and its last line from `return reply.continue();` to `return h.continue;`.

- [ ] **Step 5: Port the page-not-found hook**

In `lib/hapi-plugin/helpers/apply-server-routes.js` replace the `server.ext('onPreResponse', …)` block inside `if (appConfig.pageNotFoundView) {` with:

```js
        server.ext('onPreResponse', function(request, h) {
            // manage mismatches based upon the `scope`:
            const response = request.response;
            let uri, isHtmlPage;
            if (response.isBoom && response.output && (response.output.statusCode===404)) {
                // if request to a page, then redirect:
                uri = request.url.pathname.toUpperCase();
                isHtmlPage = uri.endsWith('.HTML') || uri.endsWith('.HTM') || (uri.lastIndexOf('.')<uri.lastIndexOf('/'));
                if (isHtmlPage) {
                    return h.reactview(appConfig.pageNotFoundView);
                }
            }
            return h.continue;
        });
```

- [ ] **Step 6: Rewrite the action handler**

Replace everything after the copyright header of `lib/hapi-plugin/helpers/action-handler.js` with:

```js
'use strict';

const prefix = process.cwd()+'/src/actions/',
    Boom = require('@hapi/boom'),
    Event = require('itsa-event'),
    LEGACY_REPLY_HINT = 'actions must return a value or h.response(...)',
    LEGACY_REPLY_ERROR = /^(h|reply) is not a function$/;

// Runs src/actions/<action>.js and returns what hapi should send (spec §6.2):
// the action's value (or {status: 'OK'}), a Boom error with its own status, or a 500.
const invoke = async (action, options, request, h, appConfig) => {
    let actionModule, clientLang, language, value;
    try {
        actionModule = require(prefix+action);
        if (typeof actionModule!=='function') {
            throw new Error('Action '+action+' should return a function');
        }
    }
    catch (err) {
        console.error(err);
        Event.emit('server:error', {message: err.message});
        return Boom.badImplementation('Action-file not found');
    }
    try {
        // if request.headers['x-lang'] then the client forces the language to be re-set
        clientLang = request.headers['x-lang'];
        // check if it is a valid langage
        if (clientLang && !appConfig.languages[clientLang]) {
            clientLang = null; // undo
        }
        language = clientLang || request.language || appConfig.defaultLanguage;
        console.debug(request, 'invoke action', '"'+action+'"', 'query:', request.query, 'params:', request.params, 'payload:', request.payload);
        value = await actionModule(request, h, options, language, appConfig);
        return value || {status: 'OK'};
    }
    catch (err) {
        if ((err instanceof TypeError) && LEGACY_REPLY_ERROR.test(err.message)) {
            console.error(err, '-->', LEGACY_REPLY_HINT);
        }
        else {
            console.error(err);
        }
        Event.emit('server:error', {message: err.message});
        return Boom.isBoom(err) ? err : Boom.badImplementation();
    }
};

module.exports = {
    invoke
};
```

- [ ] **Step 7: Port the `action` decoration**

In `lib/hapi-plugin/helpers/extend-toolkit.js` replace the `action` decoration with:

```js
    // DO NOT use arrowfunction here: we need the former context
    server.decorate('toolkit', 'action', function(action, options) {
        const h = this;
        return actionHandler.invoke(action, options, h.request, h, appConfig);
    });
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `node --test --test-force-exit tests/actions.test.js tests/middleware.test.js tests/ddos.test.js tests/debug-logging.test.js tests/startup.test.js tests/startup-broken.test.js`
Expected: PASS, all tests.

- [ ] **Step 9: Lint gate and commit**

Lint gate for `middleware.js`, `console-debug.js`, `apply-server-routes.js`, `action-handler.js`, `extend-toolkit.js`. Add the ledger line, then:

```bash
git add lib tests docs/superpowers/plans/2026-09-24-hapi21-migration-ledger.md
git commit -m "CHANGED: request middleware and actions on hapi 21 toolkit

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Views and props — `h.reactview`, `h.generateProps`, `h.setBodyDataAttr`, models

**Files:**
- Modify (full rewrite): `lib/hapi-plugin/helpers/extend-toolkit.js`
- Modify: `lib/hapi-plugin/helpers/model-handler.js`, `lib/hapi-plugin/helpers/build-props.js`
- Test: `tests/reactview.test.js`

**Interfaces:**
- Consumes: `actionHandler.invoke` (Task 3), `fixture.readViewProps` (Task 1).
- Produces: `h.reactview(view, routeOptions) → Promise<response>` (auth uses `.takeover()` on it in Task 7); `h.generateProps(view, routeOptions) → Promise<props>`; `h.setBodyDataAttr(obj)` stores on `request.app._itsa_bodyDataAttr`; model / general-model / initial-globalstate functions receive `(request, h, routeOptions, lang, appConfig)`.

- [ ] **Step 1: Write the failing tests**

`tests/reactview.test.js`:

```js
'use strict';

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fs = require('fs'),
    path = require('path'),
    fixture = require('./helpers/fixture'),
    IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

let server;

const page = async options => {
    const res = await server.inject(options);
    return {res, props: fixture.readViewProps(res.payload)};
};

before(async () => {
    server = await fixture.startServer('plain');
});

test('a full page renders the view with models merged into this.props', async () => {
    const {res, props} = await page('/');
    assert.strictEqual(res.statusCode, 200);
    assert.match(res.headers['content-type'], /^text\/html/);
    assert.ok(res.payload.startsWith('<!DOCTYPE html>'));
    assert.strictEqual(props.view, 'index');
    assert.strictEqual(props.title, 'Home');
    assert.strictEqual(props.lang, 'en');
    assert.strictEqual(props.path, '/');
    assert.strictEqual(props.device, 'desktop');
    assert.strictEqual(props.fromModel, 42);
    assert.strictEqual(props.modelGotToolkit, true);
    assert.strictEqual(props.general, 'yes');
    assert.strictEqual(props.generalGotToolkit, true);
    assert.strictEqual(props.authentication, true);
    assert.strictEqual(props.itsapagescript, '/assets/local/js/aaa111.js');
    assert.strictEqual(props.itsapagelinkcss, '/assets/local/css/aaa111.css');
});

test('uri keeps the query but drops the client timestamp', async () => {
    const {props} = await page('/?x=1&_ts=123');
    assert.strictEqual(props.uri, '/?x=1');
    assert.strictEqual(props.path, '/');
});

test('a language prefix renders in that language', async () => {
    const {props} = await page('/nl/');
    assert.strictEqual(props.lang, 'nl');
    assert.strictEqual(props.langprefix, '/nl');
    assert.strictEqual(props.title, 'Thuis');
    assert.strictEqual((await page('/nl')).props.path, '/');
});

test('a phone gets the @phone view and falls back to the base model', async () => {
    const {props} = await page({url: '/', headers: {'user-agent': IPHONE}});
    assert.strictEqual(props.view, 'index@phone');
    assert.strictEqual(props.device, 'phone');
    assert.strictEqual(props.title, 'Home phone');
    assert.strictEqual(props.itsapagescript, '/assets/local/js/bbb222.js');
    assert.strictEqual(props.fromModel, 42);
});

test('h.setBodyDataAttr reaches __bodyDataAttr', async () => {
    const {props} = await page('/bodydata');
    assert.deepStrictEqual(props.bodyDataAttr, {'data-theme': 'dark', 'data-count': '2'});
});

test('h.generateProps returns the props without rendering', async () => {
    const res = await server.inject('/generated-props');
    assert.deepStrictEqual(JSON.parse(res.payload), {view: 'index', fromModel: 42, general: 'yes', authentication: true});
});

test('ajax props return this.props as JSON without page assets', async () => {
    const res = await server.inject('/_itsa_server_ajax_/props/aaa111/'),
        body = JSON.parse(res.payload);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(body.__appProps.view, 'index');
    assert.strictEqual(body.fromModel, 42);
    assert.strictEqual(body.__appProps.itsapagescript, undefined);
    assert.ok(body.__appProps.routes.some(route => (route.path==='/') && (route.view==='index')));
});

test('ajax component and css are served with etag and a one-year ttl', async () => {
    const comp = await server.inject('/_itsa_server_ajax_/comp/aaa111/'),
        css = await server.inject('/_itsa_server_ajax_/css/aaa111/');
    assert.strictEqual(comp.statusCode, 200);
    assert.strictEqual(comp.payload, 'for(;;);window.itsaView=\'index\';');
    assert.strictEqual(comp.headers.etag, '"aaa111"');
    assert.match(comp.headers['cache-control'], /max-age=31536000/);
    assert.strictEqual(css.payload, 'h1{color:red}');
    assert.strictEqual(css.headers.etag, '"aaa111.css"');
});

test('ajax component for an unknown view is a 404', async () => {
    const res = await server.inject('/_itsa_server_ajax_/comp/aaa111/missing-view');
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.payload, 'file not found');
});

test('an unknown view serves src/file404.html with 404', async () => {
    const res = await server.inject('/missing-view');
    assert.strictEqual(res.statusCode, 404);
    assert.match(res.payload, /fixture 404/);
});

test('an unknown view without src/file404.html is a bare 404', async () => {
    const file404 = path.join(fixture.FIXTURE_APP, 'src', 'file404.html'),
        moved = file404+'.moved';
    let res;
    fs.renameSync(file404, moved);
    try {
        res = await server.inject('/missing-view');
    }
    finally {
        fs.renameSync(moved, file404);
    }
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.payload, '');
});

test('an unknown page path renders the pageNotFoundView', async () => {
    const {res, props} = await page('/does/not/exist');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(props.view, 'not-found');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test --test-force-exit tests/reactview.test.js`
Expected: FAIL — pages answer 500 (`reply is not a function` inside `reactview`).

- [ ] **Step 3: Rewrite `extend-toolkit.js`**

Keep the copyright header. Replace everything after it with the following. (`h.assets` is ported as-is here; Task 5 confines it.)

```js
'use strict';

require('itsa-jsext');

const ItsaJsxView = require('./jsx-view'),
    cwd = process.cwd(),
    Path = require('path'),
    fs = require('fs-extra'),
    actionHandler = require('./action-handler'),
    assetsHandler = require('./assets-handler'),
    modelHandler = require('./model-handler'),
    getAffinityView = require('./affinity-view'),
    buildProps = require('./build-props'),
    cachedFileContent = require('./cached-file-content'),
    authenticationHandler = require('../authentication/authentication-handler'),
    cookieHandler = require('../cookies/cookie-handler'),
    applyDataCookie = require('./apply-data-cookie'),
    changeCookies = require('./change-cookies'),
    refreshCookies = require('./refresh-cookies'),
    cookiePasswords = require(cwd+'/.cookierc'),
    ATTACK_SAFE_JSON = 'for(;;);', // see https://stackoverflow.com/questions/2669690/why-does-google-prepend-while1-to-their-json-responses
    FILE404 = 'file404.html',
    SECONDS_PER_DAY = 60 * 60 * 24,
    EXPIRE_ONE_YEAR = 365 * SECONDS_PER_DAY * 1000,
    MSG_SUB_ROUTE = {
        'props': '(ajax request for this.props)',
        'comp': '(ajax request for the Component)',
        'css': '(ajax request for the CSS)',
    };

let DEFINED_VIEWS = {};

const extend = async (server, options, appConfig, viewComponentCommon, viewComponentNrs, appTitles, clientRoutes, startupTime) => {
    const buildPrefix = '/build/',
        extraEngines = options.engines;
    let views;

    views = {
        defaultExtension: 'js',
        engines: {
            js: ItsaJsxView.View // support for .js
        },
        relativeTo: cwd+buildPrefix,
        path: 'view_components'
    };

    /*
       adding custom engines, when defined inside server.js
       by means of:
          ReactServerPlugin.options.engines: {
              ejs: require('ejs')
          };
    */
    if (Object.itsa_isObject(extraEngines)) {
        views.engines.itsa_merge(extraEngines);
    }

    server.views(views);

    // Extend with authentication:
    if (appConfig['app-authentication'] && appConfig['app-authentication'].enabled) {
        try {
            await authenticationHandler.register(server, appConfig['app-authentication'], cookiePasswords['app-authentication']);
        }
        catch (err) {
            console.error(err);
        }
    }

    // Extend with cookies:
    if (Object.itsa_isObject(appConfig.cookies)) {
        cookieHandler.register(server, appConfig.cookies['body-data-attr'], appConfig.cookies['not-exposed'], appConfig.cookies.props, appConfig.cookies.globalstate, cookiePasswords);
    }

    // builds `this.props` for a view; shared by h.reactview() and h.generateProps()
    const createProps = async (request, h, view, routeOptions, affinityView, mergeAssets, noAuthentication) => {
        const config = {};
        let props, globalstateConfig, initialGlobalStateFn, initialGlobalState, generalModelFn, generalModel,
            bodyDataAttr, replaceObject, isStringMessage, offLineMsgField;

        props = buildProps.generate(request, view, appTitles, config, appConfig, clientRoutes, startupTime);
        props.authentication = !noAuthentication;
        if (routeOptions && routeOptions.__authenticationMsg__) {
            props.authenticationMsg = routeOptions.__authenticationMsg__;
        }

        if (mergeAssets) {
            // merge the asssets into props:
            await assetsHandler.merge(props, affinityView, viewComponentCommon, viewComponentNrs, appConfig);
        }

        // apply initial state:
        globalstateConfig = appConfig.cookies && appConfig.cookies.globalstate;
        if (globalstateConfig && globalstateConfig.enabled) {
            props.__appProps.globalStateDef = {
                secure: !!globalstateConfig.onlySsl,
                'limited-props': globalstateConfig['limited-props'] || []
            };
            if (globalstateConfig['ttl-sec']) {
                props.__appProps.globalStateDef.expires = globalstateConfig['ttl-sec']*SECONDS_PER_DAY; // expires is in days from now
            }
            try {
                props.__appProps.initialGlobalState = {};
                initialGlobalStateFn = require(cwd+'/src/initial-globalstate.js');
                initialGlobalState = await initialGlobalStateFn(request, h, routeOptions, props.__appProps.lang, appConfig);
                // merge the initial globalstate into props.__appProps.initialGlobalState:
                if (Object.itsa_isObject(initialGlobalState)) {
                    props.__appProps.initialGlobalState.itsa_merge(initialGlobalState);
                }
            }
            catch (err) {
                console.error(err);
            }
        }

        // aply the general model:
        try {
            generalModelFn = require(cwd+'/src/model-general.js');
            generalModel = await generalModelFn(request, h, routeOptions, props.__appProps.lang, appConfig);
            // merge the geberal model into props:
            if (Object.itsa_isObject(generalModel)) {
                props.itsa_merge(generalModel);
            }
        }
        catch (err) {
            console.error(err);
        }

        // merge view-model:
        await modelHandler.merge(request, h, props, routeOptions, appConfig, view);

        // generate props.__bodyDataAttr, based upon the values in the `itsa-bodydata`-cookie
        if (appConfig.cookies && appConfig.cookies['body-data-attr'] && appConfig.cookies['body-data-attr'].enabled) {
            await applyDataCookie.merge(request, props);
        }
        // if h.setBodyDataAttr() is called, then merge the data:
        bodyDataAttr = request.app._itsa_bodyDataAttr;
        if (bodyDataAttr) {
            bodyDataAttr.itsa_each((value, key) => {
                props.__bodyDataAttr[((key.itsa_startsWith('data-', true)) ? key : 'data-'+key).toLowerCase()] = (typeof value==='string') ? value : JSON.stringify(value);
            });
        }

        // only now, we can add the offline message:
        if (props.__appProps.showOffline) {
            replaceObject = {};
            isStringMessage = (typeof props.__appProps.showOffline==='string');
            if (isStringMessage) {
                offLineMsgField = props.__appProps.showOffline.substring(1, props.__appProps.showOffline.length-1);
                if (offLineMsgField) {
                    replaceObject[offLineMsgField] = props[offLineMsgField]!==undefined ? props[offLineMsgField] : props.__appProps.showOffline;
                }
            }
            props.__appProps.offlineMessage = {__html: isStringMessage ? props.__appProps.showOffline.itsa_substitute(replaceObject) : 'OFFLINE'};
        }
        return props;
    };

    // Decorate `h` with the method `setBodyDataAttr`
    // stored on request.app: hapi 21 gives every lifecycle step its own `h`
    server.decorate('toolkit', 'setBodyDataAttr', function(props) {
        const request = this.request;
        if (Object.itsa_isObject(props)) {
            request.app._itsa_bodyDataAttr = props.itsa_deepClone();
        }
    });

    // DO NOT use arrowfunction here: we need the former context
    server.decorate('toolkit', 'action', function(action, options) {
        const h = this;
        return actionHandler.invoke(action, options, h.request, h, appConfig);
    });

    // DO NOT use arrowfunction here: we need the former context
    server.decorate('toolkit', 'assets', function(filename) {
        const prefix = cwd+buildPrefix+'public/assets/'+appConfig.packageVersion+'/';
        return this.file(Path.join(prefix, filename));
    });

    // DO NOT use arrowfunction here: we need the former context
    server.decorate('toolkit', 'generateProps', async function(view, routeOptions) {
        const h = this;
        let props;
        try {
            props = await createProps(h.request, h, view, routeOptions || {}, undefined, true, false);
        }
        catch (err) {
            console.warn(err);
        }
        return props;
    });

    // DO NOT use arrowfunction here: we need the former context
    server.decorate('toolkit', 'reactview', async function(view, routeOptions) { // NO ARROW FUNCTION --> we need `this` as it is set (===h)
        const h = this,
            request = h.request;
        let props, affinityView, data, ajaxProperties, ajaxComp, ajaxCss, sendRequireId, file404, noAuthentication, debugIntro;

        const withNoAuth = response => {
            if (noAuthentication) {
                response.header('x-noauth', 'true');
            }
            return response;
        };

        try {
            ajaxProperties = (request.headers['x-ajaxtype']==='props');
            ajaxComp = (request.headers['x-ajaxtype']==='comp');
            ajaxCss = (request.headers['x-ajaxtype']==='css');
            if (appConfig.debug) { // to prevent as less load as possible, we check for `appConfig.debug` --> console.debug does this check also by itself
                if (request.headers['x-itsa-serviceworker-init']==='true') {
                    debugIntro = 'Responding serviceworker pre cache for view:';
                }
                else {
                    debugIntro = 'Responding server route for view:';
                }
                console.debug(request, debugIntro, '"'+view+'"', MSG_SUB_ROUTE[request.headers['x-ajaxtype']] || '(full page)');
            }

            // look if  we need to set __sendRequireId__:
            sendRequireId = !!(routeOptions && routeOptions.__sendRequireId__);
            noAuthentication = !!(routeOptions && !!routeOptions.__noAuth__);

            if (ajaxProperties) {
                // check if we need to change any cookies that may have been send with the payload:
                changeCookies.generate(request, h);
            }

            // set modelcontext and assetscontext for usage inside templates:
            affinityView = await getAffinityView.generate(view, request.affinity);

            // build `this.props`:
            if (!ajaxComp && !ajaxCss) {
                props = await createProps(request, h, view, routeOptions, affinityView, !ajaxProperties, noAuthentication);
            }

            // reply differently for ajax-requests:
            if (ajaxComp) {
                if (!viewComponentNrs[affinityView]) {
                    return h.response('file not found').code(404);
                }
                data = await cachedFileContent.readFile(cwd+buildPrefix+'private/assets/js/'+viewComponentNrs[affinityView].hash+'.js', 'utf8');
                if (sendRequireId) {
                    // find the right sendRequireId for this view, for the view had been changed
                    // probably by the module itsa-authentication
                    data = 'window.itsa_requireId=' + viewComponentNrs[affinityView].requireId + ';' + data;
                }
                // reply with attack-safe json --> will be removed at the client
                return withNoAuth(h.response(ATTACK_SAFE_JSON+data).ttl(EXPIRE_ONE_YEAR).etag(viewComponentNrs[affinityView].hash));
            }
            if (ajaxCss) {
                if (!viewComponentNrs[affinityView]) {
                    return h.response('file not found').code(404);
                }
                data = await cachedFileContent.readFile(cwd+buildPrefix+'private/assets/css/'+viewComponentNrs[affinityView].cssfile, 'utf8');
                return withNoAuth(h.response(data).ttl(EXPIRE_ONE_YEAR).etag(viewComponentNrs[affinityView].cssfile));
            }
            if (ajaxProperties) {
                // refresh the ttl of the cookies
                refreshCookies.refresh(request, h, appConfig);
                return withNoAuth(h.response(props));
            }
            if (DEFINED_VIEWS[affinityView]===true) {
                // refresh the ttl of the cookies
                refreshCookies.refresh(request, h, appConfig);
                return withNoAuth(h.view(affinityView, props));
            }
            if (DEFINED_VIEWS[affinityView]===undefined) {
                try {
                    await fs.stat(cwd+'/build/view_components/'+affinityView+'.js');
                    DEFINED_VIEWS[affinityView] = true;
                }
                catch (err) {
                    DEFINED_VIEWS[affinityView] = false;
                }
                if (DEFINED_VIEWS[affinityView]) {
                    // the first request for a view does not refresh the cookie ttl (as in 17.x)
                    return withNoAuth(h.view(affinityView, props));
                }
            }
            file404 = cwd+'/src/'+FILE404;
            try {
                await fs.stat(file404);
            }
            catch (err) {
                return h.response().code(404);
            }
            return h.file(file404).code(404);
        }
        catch (err) {
            console.warn(err);
            throw err;
        }
    });
};

module.exports = {
    extend
};
```

- [ ] **Step 4: Port the model handler and `this.props.__appProps.uri`**

`lib/hapi-plugin/helpers/model-handler.js`:
- `const merge = async (request, reply, props, routeOptions, appConfig, view) => {` → `const merge = async (request, h, props, routeOptions, appConfig, view) => {`
- `modelProps = await modelFn(request, reply, routeOptions || {}, props.__appProps.lang, appConfig);` → `modelProps = await modelFn(request, h, routeOptions || {}, props.__appProps.lang, appConfig);`

`lib/hapi-plugin/helpers/build-props.js`: replace

```js
    props.__appProps.uri = request.url.path.replace(REGEXP_TS, '').itsa_replaceAll('//', '/');
```

with

```js
    props.__appProps.uri = (request.url.pathname+request.url.search).replace(REGEXP_TS, '').itsa_replaceAll('//', '/');
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test --test-force-exit tests/reactview.test.js tests/actions.test.js tests/middleware.test.js tests/startup.test.js`
Expected: PASS, all tests.

- [ ] **Step 6: Lint gate and commit**

Lint gate for `extend-toolkit.js`, `model-handler.js`, `build-props.js`. Add the ledger line, then:

```bash
git add lib tests docs/superpowers/plans/2026-09-24-hapi21-migration-ledger.md
git commit -m "CHANGED: h.reactview, h.generateProps and models on hapi 21

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Built-in routes and the asset path-traversal fix

**Files:**
- Modify (full rewrite of the route definitions): `lib/hapi-plugin/helpers/apply-server-routes.js`
- Modify: `lib/hapi-plugin/helpers/extend-toolkit.js` (the `assets` decoration only)
- Test: `tests/builtin-routes.test.js`, `tests/builtin-cdn-sw.test.js`

**Interfaces:**
- Consumes: plugin registration (Task 2), page-not-found hook (Task 3).
- Produces: built-in routes answering on hapi 21; every asset route and `h.assets()` confine files to their base directory (spec §4.5 security fix).

- [ ] **Step 1: Write the failing tests**

`tests/builtin-routes.test.js`:

```js
'use strict';

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture');

let server;

const get = url => server.inject(url);

before(async () => {
    server = await fixture.startServer('plain');
});

test('favicon is served from the versioned assets', async () => {
    const res = await get('/favicon.ico');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload, 'fixture-icon');
});

test('assets are served from every asset route', async () => {
    const cases = {
        '/assets/hello.txt': 'hello asset',
        '/assets/1.0.0/hello.txt': 'hello asset',
        '/assets/1.0.0/sub/deep.txt': 'deep asset',
        '/assets-private/1.0.0/secret.txt': 'private asset',
        '/assets/local/js/aaa111.js': 'window.itsaView=\'index\';',
        '/assets/_itsa_server_external_modules/react/x.js': 'window.itsaExternal=true;',
        '/asset-helper': 'hello asset'
    };
    for (const url of Object.keys(cases)) {
        const res = await get(url);
        assert.strictEqual(res.statusCode, 200, url);
        assert.strictEqual(res.payload, cases[url], url);
        if (url!=='/asset-helper') {
            assert.match(res.headers['cache-control'], /private/, url);
        }
    }
});

test('an encoded ../ cannot escape any asset directory (spec §4.5 security fix)', async () => {
    const attacks = [
        '/assets/..%2F..%2F..%2F..%2F.cookierc',
        '/assets/1.0.0/..%2F..%2F..%2F..%2F.cookierc',
        '/assets-private/1.0.0/..%2F..%2F..%2F..%2F.cookierc',
        '/assets/local/..%2F..%2F..%2F.cookierc',
        '/assets/_itsa_server_external_modules/..%2F..%2F..%2F..%2F.cookierc',
        '/assets/local/..%2F..%2F..%2Fpackage.json',
        '/asset-helper/..%2F..%2F..%2F..%2F.cookierc'
    ];
    for (const url of attacks) {
        const res = await get(url);
        assert.strictEqual(res.statusCode, 403, url);
        assert.ok(!res.payload.includes('module.exports'), url);
        assert.ok(!res.payload.includes('fixture-app'), url);
    }
});

test('the service worker is empty while disabled', async () => {
    const res = await get('/_itsa_server_serviceworker.js');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload, '');
    assert.strictEqual(res.headers['content-type'], 'application/javascript; charset=utf-8');
    assert.strictEqual(res.headers['cache-control'], 'no-cache, no-store, must-revalidate');
});
```

`tests/builtin-cdn-sw.test.js`:

```js
'use strict';

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture');

let server;

before(async () => {
    server = await fixture.startServer('plain', {
        cdn: {enabled: true, url: 'https://cdn.example.com'},
        'service-workers': {enabled: true}
    });
});

test('with a CDN, favicon permanently redirects to the CDN', async () => {
    const res = await server.inject('/favicon.ico');
    assert.strictEqual(res.statusCode, 301);
    assert.strictEqual(res.headers.location, 'https://cdn.example.com/assets/1.0.0/favicon.ico');
});

test('an enabled service worker is generated with the CDN url', async () => {
    const res = await server.inject('/_itsa_server_serviceworker.js');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-type'], 'application/javascript; charset=utf-8');
    assert.strictEqual(res.headers['cache-control'], 'no-cache, no-store, must-revalidate');
    assert.ok(res.payload.includes('https://cdn.example.com/'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test --test-force-exit tests/builtin-routes.test.js tests/builtin-cdn-sw.test.js`
Expected: FAIL — built-in routes answer 500 (`reply.file is not a function`).

- [ ] **Step 3: Port the built-in routes with confinement**

In `lib/hapi-plugin/helpers/apply-server-routes.js` replace everything from the first `routes.push({` down to (not including) the `serverConnection.route(routes);` line with:

```js
    routes.push({
        method: 'GET',
        path: '/favicon.ico',
        handler: function(request, h) {
            if (appConfig.cdn && appConfig.cdn.enabled) {
                return h.redirect(favicon).permanent().rewritable();
            }
            return h.file(favicon);
        },
        options: {
            cache: {
                expiresIn: EXPIRE_ONE_YEAR,
                privacy: 'private'
            }
        }
    });

    // All asset routes pass `confine`: an encoded `..%2F` inside the filename would otherwise escape the
    // directory and serve any file of the app (like .cookierc). A confined miss answers 403.

    // assets created with `require` follow with as deep nested as needed, they also have a version in the url:
    routes.push({
        method: 'GET',
        path: '/assets/'+appConfig.packageVersion+'/{filename*}',
        handler: function(request, h) {
            // inert will set an eTag. We leave `no-cache` because the file might change while the name keeps the same.
            return h.file(request.params.filename, {confine: cwdPrefix+'/public/assets/'+appConfig.packageVersion});
        },
        options: {
            cache: {
                expiresIn: EXPIRE_ONE_YEAR,
                privacy: 'private'
            }
        }
    });

    // assets created with `require` follow with as deep nested as needed, they also have a version in the url:
    routes.push({
        method: 'GET',
        path: '/assets-private/'+appConfig.packageVersion+'/{filename*}',
        handler: function(request, h) {
            // inert will set an eTag. We leave `no-cache` because the file might change while the name keeps the same.
            return h.file(request.params.filename, {confine: cwdPrefix+'/private/assets-private/'+appConfig.packageVersion});
        },
        options: {
            cache: {
                expiresIn: EXPIRE_ONE_YEAR,
                privacy: 'private'
            }
        }
    });

    // external modules, created by webpack
    routes.push({
        method: 'GET',
        path: '/assets/_itsa_server_external_modules/{versionedmodule*}',
        handler: function(request, h) {
            return h.file(request.params.versionedmodule, {confine: cwdPrefix+'/public/assets/_itsa_server_external_modules'});
        },
        options: {
            cache: {
                expiresIn: EXPIRE_TEN_YEARS,
                privacy: 'private'
            }
        }
    });

    routes.push({
        method: 'GET',
        path: '/assets/local/{filename*}',
        handler: function(request, h) {
            // inert will set an eTag. We leave `no-cache` because the file might change while the name keeps the same.
            return h.file(request.params.filename, {confine: cwdPrefix+'/private/assets'});
        },
        options: {
            cache: {
                expiresIn: EXPIRE_ONE_YEAR,
                privacy: 'private'
            }
        }
    });

    routes.push({
        method: 'GET',
        path: '/assets/{filename*}',
        handler: function(request, h) {
            // inert will set an eTag. We leave `no-cache` because the file might change while the name keeps the same.
            return h.file(request.params.filename, {confine: cwdPrefix+'/public/assets/'+appConfig.packageVersion});
        },
        options: {
            cache: {
                expiresIn: EXPIRE_ONE_YEAR,
                privacy: 'private'
            }
        }
    });

    routes.push({
        method: 'GET',
        path: '/_itsa_server_serviceworker.js',
        handler: async function(request, h) {
            let fileContent;
            if (appConfig['service-workers'] && appConfig['service-workers'].enabled) {
                try {
                    fileContent = await generateServiceWorker.generateFile(startupTime, urlsToCache, OFFLINE_IMAGE, OFFLINE_PAGE, appConfig.socketPort || 4002, (appConfig.cdn && appConfig.cdn.enabled) ? appConfig.cdn.url : null);
                }
                catch (err) {
                    console.warn(err);
                    throw err;
                }
                return h.response(fileContent).type('application/javascript; charset=utf-8').header('Cache-Control', 'no-cache, no-store, must-revalidate');
            }
            return h.response('').type('application/javascript; charset=utf-8').header('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    });

```

- [ ] **Step 4: Confine `h.assets()`**

In `lib/hapi-plugin/helpers/extend-toolkit.js` replace the `assets` decoration with:

```js
    // DO NOT use arrowfunction here: we need the former context
    // `confine` keeps the file inside the versioned assets directory (see apply-server-routes.js)
    server.decorate('toolkit', 'assets', function(filename) {
        return this.file(filename, {confine: cwd+buildPrefix+'public/assets/'+appConfig.packageVersion});
    });
```

`Path` is no longer used in this file: remove `Path = require('path'),` from the `const` list.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test --test-force-exit tests/builtin-routes.test.js tests/builtin-cdn-sw.test.js tests/reactview.test.js tests/middleware.test.js`
Expected: PASS, all tests. If a traversal case answers 404 instead of 403, check that the handler passes the *relative* `request.params.*` value (not a joined absolute path) together with `confine`.

- [ ] **Step 6: Lint gate and commit**

Lint gate for `apply-server-routes.js`, `extend-toolkit.js`. Add the ledger line, then:

```bash
git add lib tests docs/superpowers/plans/2026-09-24-hapi21-migration-ledger.md
git commit -m "FIXED: confine asset routes to their directory (path traversal); built-in routes on hapi 21

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Encrypted cookies

**Files:**
- Modify: `lib/hapi-plugin/cookies/cookie.js`, `lib/hapi-plugin/cookies/cookie-handler.js`, `lib/hapi-plugin/helpers/change-cookies.js`, `lib/hapi-plugin/helpers/refresh-cookies.js`
- Test: `tests/cookies.test.js`

**Interfaces:**
- Consumes: `h.reactview` ajax props flow (Task 4), `fixture.parseSetCookies`, `fixture.cookieHeader` (Task 1).
- Produces: `Cookie#defineProps(h, props, ttlSec)`, `#setProps(h, props, ttlSec)`, `#deleteProp(h, key)`, `#removeCookie(h)`, `#changeTtl(h, ttlSec)`, `#refreshTtl(h)`, `#getProps()`, `#cookieIsSet()` — used by the auth cookie in Task 7.

- [ ] **Step 1: Write the failing tests**

`tests/cookies.test.js` (tests run in file order; the ttl tests change a module-level ttl and stay last):

```js
'use strict';

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture'),
    PROPS_URL = '/_itsa_server_ajax_/props/aaa111/';

let server, defined;

const cookieAction = (action, extra) => Object.assign({'x-cookie': 'itsa-props', 'x-action': action}, extra);
const findCookie = (res, name) => fixture.parseSetCookies(res).find(cookie => cookie.name===name);
const readCookies = async (...responses) => JSON.parse((await server.inject({url: '/act/cookies', headers: {cookie: fixture.cookieHeader(...responses)}})).payload);

before(async () => {
    server = await fixture.startServer('cookies');
});

test('define sets an encrypted itsa-props cookie with SameSite=Lax', async () => {
    const res = await server.inject({url: PROPS_URL, headers: cookieAction('define', {'x-cookieprops': '{"color":"blue","size":3}'})}),
        cookie = findCookie(res, 'itsa-props');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(cookie && cookie.value.startsWith('Fe26.2**'), JSON.stringify(cookie));
    assert.strictEqual(cookie.attributes.samesite, 'Lax');
    assert.strictEqual(cookie.attributes['max-age'], '31536000');
    assert.strictEqual(cookie.attributes.httponly, true);
    defined = res;
});

test('the cookie is readable server side and in this.props, and props requests refresh it', async () => {
    const res = await server.inject({url: PROPS_URL, headers: {cookie: fixture.cookieHeader(defined)}});
    assert.deepStrictEqual((await readCookies(defined)).props, {color: 'blue', size: 3});
    assert.deepStrictEqual(JSON.parse(res.payload).__appProps.cookie, {color: 'blue', size: 3});
    assert.strictEqual(findCookie(res, 'itsa-props').attributes['max-age'], '31536000');
});

test('set merges into the cookie and delete removes one key', async () => {
    const set = await server.inject({url: PROPS_URL, headers: Object.assign(cookieAction('set', {'x-cookieprops': '{"size":4}'}), {cookie: fixture.cookieHeader(defined)})}),
        deleted = await server.inject({url: PROPS_URL, headers: Object.assign(cookieAction('delete', {'x-key': 'color'}), {cookie: fixture.cookieHeader(defined, set)})});
    assert.deepStrictEqual((await readCookies(defined, set)).props, {color: 'blue', size: 4});
    assert.deepStrictEqual((await readCookies(defined, set, deleted)).props, {size: 4});
});

test('the body-data-attr cookie reaches __bodyDataAttr on full pages', async () => {
    const res = await server.inject({url: PROPS_URL, headers: {'x-cookie': 'itsa-bodydata', 'x-action': 'define', 'x-cookieprops': '{"zoom":"2"}'}}),
        props = fixture.readViewProps((await server.inject({url: '/', headers: {cookie: fixture.cookieHeader(res)}})).payload);
    assert.deepStrictEqual(props.bodyDataAttr, {'data-zoom': '2'});
    assert.deepStrictEqual(props.bodyattrcookie, {zoom: '2'});
});

test('an action sets a not-exposed cookie through h', async () => {
    const res = await server.inject('/act/set-notexposed');
    assert.ok(findCookie(res, 'itsa-notexposed').value.startsWith('Fe26.2**'));
    assert.deepStrictEqual((await readCookies(res)).notexposed, {secret: 'value'});
});

test('the globalstate cookie is decoded by request.getClientGlobalstate()', async () => {
    const res = await server.inject({url: '/act/cookies', headers: {cookie: 'globalstate='+encodeURIComponent('{"a":1}')}});
    assert.deepStrictEqual(JSON.parse(res.payload).globalstate, {a: 1});
});

test('the initial globalstate is merged into this.props and receives h', async () => {
    const props = fixture.readViewProps((await server.inject('/')).payload);
    assert.deepStrictEqual(props.initialGlobalState, {counter: 1, stateGotToolkit: true});
});

test('ttl sets Max-Age in seconds (changeTtl fix, spec §4.12)', async () => {
    const res = await server.inject({url: PROPS_URL, headers: Object.assign(cookieAction('ttl', {'x-ms': '600'}), {cookie: fixture.cookieHeader(defined)})});
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(findCookie(res, 'itsa-props').attributes['max-age'], '600');
});

test('a non-numeric x-ms falls back to TTL 0, as in 17.x (Review Focus 4)', async () => {
    const res = await server.inject({url: PROPS_URL, headers: Object.assign(cookieAction('ttl', {'x-ms': 'abc'}), {cookie: fixture.cookieHeader(defined)})});
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(findCookie(res, 'itsa-props').attributes['max-age'], '0');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test --test-force-exit tests/cookies.test.js`
Expected: FAIL — `startServer('cookies')` rejects (`Cannot read properties of undefined (reading 'state')` from `server.root`).

- [ ] **Step 3: Port `cookie.js`**

In `lib/hapi-plugin/cookies/cookie.js`:

1. In `_register`, after the line `options.itsa_merge(PROTECTED_COOKIE_OPTIONS, {force: true});` add:

```js
                    // hapi 21 defaults to SameSite=Strict, which drops the cookie on links from other sites
                    options.isSameSite = 'Lax';
```

2. Replace the methods `defineProps` through `refreshTtl` with:

```js
    defineProps(h, props, ttlSec) {
        let ttlConfig;
        if (Object.itsa_isObject(props)) {
            this._storeTempRepliedCookie(props);
            if (ttlSec!==undefined) {
                ttlConfig = {
                    ttl: (typeof ttlSec==='number') ? ttlSec*1000 : undefined
                };
            }
            console.debug(h.request, 'Define cookie', this.cookieName, props, 'ttlConfig:', ttlConfig);
            h.state(this.cookieName, props, ttlConfig);
        }
    },
    getProps() {
        let cookie = this.request['__itsa_cookie_'+this.cookieName] || (this.request.state && this.request.state[this.cookieName]);
        // for some reasson, IE returns an array
        if (Array.isArray(cookie)) {
            cookie = cookie[0];
        }
        return Object.itsa_isObject(cookie) ? cookie : {};
    },
    setProps(h, props, ttlSec) {
        let cookie, ttlConfig;
        if (Object.itsa_isObject(props)) {
            cookie = this.getProps();
            cookie.itsa_merge(props, {force: true});
            this._storeTempRepliedCookie(cookie);
            if (ttlSec!==undefined) {
                ttlConfig = {
                    ttl: (typeof ttlSec==='number') ? ttlSec*1000 : undefined
                };
            }
            console.debug(h.request, 'Set props for cookie', this.cookieName, 'props:', cookie, 'ttlConfig:', ttlConfig);
            h.state(this.cookieName, cookie, ttlConfig);
        }
    },
    cookieIsSet() {
        return !this.getProps().itsa_isEmpty();
    },
    deleteProp(h, key) {
        let cookie;
        if (typeof key==='string') {
            cookie = this.getProps();
            if (cookie) {
                delete cookie[key];
                this._storeTempRepliedCookie(cookie);
                console.debug(h.request, 'Delete property', key, 'from cookie', this.cookieName);
                h.state(this.cookieName, cookie);
            }
        }
    },
    removeCookie(h) {
        delete this.request['__itsa_cookie_'+this.cookieName];
        console.debug(h.request, 'Remove cookie', this.cookieName);
        h.unstate(this.cookieName, {ttl: 0});
    },
    changeTtl(h, ttlSec) {
        let cookie = this.getProps(),
            ttl;
        if (cookie) {
            ttl = (typeof ttlSec==='number') ? ttlSec*1000 : 0;
            REGISTERED_TTL[this.cookieName] = ttl;
            h.state(this.cookieName, cookie, {ttl: ttl});
        }
    },
    refreshTtl(h) {
        let cookie, ttl;
        if (this.cookieIsSet()) {
            ttl = REGISTERED_TTL[this.cookieName];
            cookie = this.getProps();
            h.state(this.cookieName, cookie, {ttl: (typeof ttl==='number') ? ttl : undefined});
        }
    },
```

- [ ] **Step 4: Port the cookie handler and the cookie helpers**

`lib/hapi-plugin/cookies/cookie-handler.js`: replace `const serverConnection = server.root;` with `const serverConnection = server;`.

`lib/hapi-plugin/helpers/change-cookies.js`: replace the `generate` function with:

```js
const generate = (request, h) => {
    const cookie = request.headers['x-cookie'];
    let cookieAction, cookieProps, ttlSec;
    if (cookie) {
        cookieAction = request.headers['x-action'];
        if (cookieAction==='define') {
            try {
                cookieProps = JSON.parse(request.headers['x-cookieprops']);
                request[COOKIE_DEFS[cookie]]().defineProps(h, cookieProps);
            }
            catch (err) {}
        }
        else if (cookieAction==='set') {
            try {
                cookieProps = JSON.parse(request.headers['x-cookieprops']);
                request[COOKIE_DEFS[cookie]]().setProps(h, cookieProps);
            }
            catch (err) {}
        }
        else if (cookieAction==='delete') {
            request[COOKIE_DEFS[cookie]]().deleteProp(h, request.headers['x-key']);
        }
        else if (cookieAction==='remove') {
            request[COOKIE_DEFS[cookie]]().removeCookie(h);
        }
        else if (cookieAction==='ttl') {
            // the header arrives as a string; the server treats the value as seconds
            ttlSec = Number(request.headers['x-ms']);
            request[COOKIE_DEFS[cookie]]().changeTtl(h, Number.isFinite(ttlSec) ? ttlSec : undefined);
        }

    }
};
```

`lib/hapi-plugin/helpers/refresh-cookies.js`: rename the parameter `reply` to `h` in `refresh(request, reply, appConfig)` and in its four `.refreshTtl(reply)` calls.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test --test-force-exit tests/cookies.test.js tests/reactview.test.js`
Expected: PASS, all tests.

- [ ] **Step 6: Lint gate and commit**

Lint gate for the four files. Add the ledger line, then:

```bash
git add lib tests docs/superpowers/plans/2026-09-24-hapi21-migration-ledger.md
git commit -m "CHANGED: encrypted cookies on hapi 21 (SameSite=Lax); FIXED: changeTtl deleted the cookie

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Authentication

**Files:**
- Modify (full rewrite): `lib/hapi-plugin/authentication/authentication-handler.js`, `lib/hapi-plugin/authentication/authentication-plugin.js`
- Test: `tests/auth.test.js`

**Interfaces:**
- Consumes: `h.reactview(...)` returning a response (Task 4), `Cookie` with `h` (Task 6).
- Produces: `h.login(credentials, sessionCookie, ttlSec)`, `h.logout()`, auth scheme `itsa-react-server-auth`; `validateFunc(request, h, authCookie)`.

- [ ] **Step 1: Write the failing tests**

`tests/auth.test.js`:

```js
'use strict';

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture');

let server, userLogin;

const findCookie = (res, name) => fixture.parseSetCookies(res).find(cookie => cookie.name===name);
const login = payload => server.inject({method: 'POST', url: '/login', payload});
const page = async options => {
    const res = await server.inject(options);
    return {res, props: fixture.readViewProps(res.payload)};
};

before(async () => {
    server = await fixture.startServer('auth');
});

test('an anonymous request to a protected route renders the login view (takeover)', async () => {
    const {res, props} = await page('/private');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['x-noauth'], 'true');
    assert.strictEqual(props.view, 'login');
    assert.strictEqual(props.authentication, false);
});

test('an anonymous ajax props request gets the login props with x-noauth', async () => {
    const res = await server.inject('/_itsa_server_ajax_/props/eee555/private');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['x-noauth'], 'true');
    assert.strictEqual(JSON.parse(res.payload).__appProps.view, 'login');
});

test('a protected route declared with the legacy `config:` key is protected (Review Focus 5)', async () => {
    const {res, props} = await page('/legacy-config-private');
    assert.strictEqual(res.headers['x-noauth'], 'true');
    assert.strictEqual(props.view, 'login');
});

test('client routes flag protected routes as private for `options:` and `config:` (Review Focus 5)', async () => {
    const routes = JSON.parse((await server.inject('/_itsa_server_ajax_/props/aaa111/public')).payload).__appProps.routes,
        privateView = routePath => routes.find(route => route.path===routePath).privateView;
    assert.strictEqual(privateView('/private'), true);
    assert.strictEqual(privateView('/legacy-config-private'), true);
    assert.strictEqual(privateView('/public'), false);
});

test('h.login sets itsa-id with SameSite=Lax and the manifest ttl', async () => {
    const cookie = findCookie(userLogin = await login({scope: 'user'}), 'itsa-id');
    assert.strictEqual(userLogin.statusCode, 200);
    assert.ok(cookie.value.startsWith('Fe26.2**'));
    assert.strictEqual(cookie.attributes.samesite, 'Lax');
    assert.strictEqual(cookie.attributes['max-age'], '1800');
    assert.strictEqual(cookie.attributes.httponly, true);
});

test('the auth cookie opens the protected route', async () => {
    const {res, props} = await page({url: '/private', headers: {cookie: fixture.cookieHeader(userLogin)}});
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['x-noauth'], undefined);
    assert.strictEqual(props.view, 'private');
    assert.strictEqual(props.loggedIn, true);
    assert.strictEqual(props.scope, 'user');
});

test('an insufficient scope (403) renders the login view', async () => {
    const {res, props} = await page({url: '/admin', headers: {cookie: fixture.cookieHeader(userLogin)}});
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['x-noauth'], 'true');
    assert.strictEqual(props.view, 'login');
});

test('a string from validateFunc becomes the login message', async () => {
    const blocked = await login({scope: 'user', blocked: true}),
        {props} = await page({url: '/private', headers: {cookie: fixture.cookieHeader(blocked)}});
    assert.strictEqual(props.view, 'login');
    assert.strictEqual(props.authenticationMsg, 'Account blocked');
});

test('h.logout in an action unsets itsa-id', async () => {
    const res = await server.inject({method: 'POST', url: '/logout', headers: {cookie: fixture.cookieHeader(userLogin)}}),
        cookie = findCookie(res, 'itsa-id');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(cookie.value, '');
    assert.strictEqual(cookie.attributes['max-age'], '0');
});

// The unset cookie is NOT asserted: rendering the login view refreshes the auth cookie from the request,
// which overrides h.logout()'s unstate. That is 17.x behaviour (the parity test pins it), not part of the port.
test('validateFunc receives h and can call h.logout()', async () => {
    const {res, props} = await page({url: '/private?logout=toolkit', headers: {cookie: fixture.cookieHeader(userLogin)}});
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(props.view, 'login');
});

test('a service-worker init request is authenticated with the route scope', async () => {
    const {res, props} = await page({url: '/private', headers: {'x-itsa-serviceworker-init': 'true'}});
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['x-noauth'], undefined);
    assert.strictEqual(props.view, 'private');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test --test-force-exit tests/auth.test.js`
Expected: FAIL — the auth plugin cannot register (`Invalid plugin options` / `server.root` undefined), so auth routes reject at registration.

- [ ] **Step 3: Rewrite `authentication-handler.js`**

Keep the copyright header; replace the rest with:

```js
const path = require('path'),
    authenticationPlugin = require('./authentication-plugin'),
    cwd = process.cwd();

module.exports = {
    async register(server, authConfig, password) {
        await server.register({
            plugin: authenticationPlugin,
            options: {
                password,
                'ttl-sec': authConfig['ttl-sec'],
                'session-cookie': authConfig['session-cookie'],
                onlySsl: (typeof authConfig.onlySsl==='boolean') ? authConfig.onlySsl : true // <-- force cookies to be seen over https only!!
            }
        });
        // now, generate the strategies:
        authConfig.strategies.forEach(item => {
            let validateFunc;
            try {
                if (item.validateFunc) {
                    validateFunc = require(path.resolve(cwd, item.validateFunc));
                }
                server.auth.strategy(item.strategy, 'itsa-react-server-auth', {
                    validateFunc,
                    loginView: item.loginView || authConfig.loginView,
                    password
                });
            }
            catch (err) {
                console.warn(err);
            }
        });
    }
};
```

- [ ] **Step 4: Rewrite `authentication-plugin.js`**

Keep the copyright header and the fork comment; replace the rest with:

```js
'use strict';

require('itsa-jsext');

const COOKIE_NAME = 'itsa-id',
    AuthCookie = require('./auth-cookie');

const DEFAULT_COOKIE_OPTIONS = {
    encoding: 'iron',
    isSecure: true,
    path: '/',
    isHttpOnly: true,
    clearInvalid: true,
    ignoreErrors: true
};

// Declare internals
let internals = {};

const getValidScope = function(request) {
    const config = request.server.auth.lookup(request.route),
        access = config && config.access, // is an array
        item = access && access.find(item => item.scope),
        scope = item && item.scope.selection && item.scope.selection[0];
    return scope || 'unknown';
};

internals.implementation = function(server, options) {
    const validateFunc = options.validateFunc,
        loginView = options.loginView;

    const renderLoginView = async (h, authenticationMsg) => {
        const response = await h.reactview(loginView, {__sendRequireId__: true, __noAuth__: true, __authenticationMsg__: authenticationMsg});
        return response.takeover();
    };

    server.ext('onPreResponse', function(request, h) {
        // manage mismatches based upon the `scope`:
        const response = request.response;
        if (response.isBoom && response.output && (response.output.statusCode===403)) {
            console.debug(request, 'wrong authentication scope: redirecting to the loginView');
            return h.reactview(loginView, {__sendRequireId__: true, __noAuth__: true});
        }
        return h.continue;
    });

    return {
        authenticate: async function(request, h) {
            let validatedResponse, authCookie, authenticationMsg;
            if (request.headers['x-itsa-serviceworker-init']==='true') {
                return h.authenticated({credentials: {scope: getValidScope(request)}});
            }
            try {
                authCookie = request.getAuthCookie();
                // now check by validateFunc (if any)
                validatedResponse = (typeof validateFunc==='function') ? await validateFunc(request, h, authCookie) : true;
            }
            catch (err) {
                console.debug(request, 'general authentication error at the validateFn: redirecting to the loginView');
                return renderLoginView(h);
            }
            if (validatedResponse!==true) {
                if (typeof validatedResponse==='string') {
                    authenticationMsg = validatedResponse;
                }
                console.debug(request, 'no authentication by the validateFn: redirecting to the loginView');
                return renderLoginView(h, authenticationMsg);
            }
            return h.authenticated({credentials: authCookie.getProps()});
        }
    };
};

const register = async (server, options) => {
    const defaultTtlSec = options['ttl-sec'] ? options['ttl-sec'] : undefined,
        defaultSessionCookie = options['session-cookie'] || false,
        cookieOptions = DEFAULT_COOKIE_OPTIONS.itsa_deepClone().itsa_merge(options, {force: true});
    // setup the cookie:
    new AuthCookie({
        cookieName: COOKIE_NAME,
        server,
        options: cookieOptions
    });
    server.decorate('request', 'getAuthCookie', function() {
        return new AuthCookie({
            cookieName: COOKIE_NAME,
            request: this
        });
    });
    server.decorate('toolkit', 'logout', function() {
        const h = this;
        h.request.getAuthCookie().removeCookie(h);
    });
    server.decorate('toolkit', 'login', function(credentials, sessionCookie, userTtlSec) {
        const h = this;
        let ttlSec;
        if ((typeof sessionCookie!=='boolean') && !userTtlSec) {
            sessionCookie = defaultSessionCookie;
        }
        if (typeof sessionCookie==='boolean') {
            ttlSec = sessionCookie ? null : (userTtlSec || defaultTtlSec); // set to `null`, NOT `undefined` --> force the new ttl to be set
        }
        else {
            ttlSec = userTtlSec || defaultTtlSec;
        }
        h.request.getAuthCookie().defineProps(h, credentials, ttlSec);
    });
    server.auth.scheme('itsa-react-server-auth', internals.implementation);
};

module.exports = {
    name: 'itsaReactServerAuth',
    version: '1.0.0',
    register
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test --test-force-exit tests/auth.test.js tests/cookies.test.js tests/reactview.test.js`
Expected: PASS, all tests.

- [ ] **Step 6: Lint gate and commit**

Lint gate for both files. Add the ledger line, then:

```bash
git add lib tests docs/superpowers/plans/2026-09-24-hapi21-migration-ledger.md
git commit -m "CHANGED: authentication scheme, h.login and h.logout on hapi 21

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Socket server

**Files:**
- Modify: `lib/socketio/socketserver.js` (constructor)
- Test: `tests/socketserver.test.js`

**Interfaces:**
- Consumes: plugin startup (Task 2) with `socketServer.enabled`.
- Produces: socket.io 2 listening on its own hapi 21 server.

- [ ] **Step 1: Write the failing test**

`tests/socketserver.test.js`:

```js
'use strict';

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture'),
    PORT = 4791;

let server;

const poll = async url => {
    let lastError;
    for (let attempt = 0; attempt<30; attempt++) {
        try {
            return await fetch(url);
        }
        catch (err) {
            lastError = err;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    throw lastError;
};

before(async () => {
    server = await fixture.startServer('plain', {
        socketServer: {enabled: true, host: '127.0.0.1', port: PORT, 'proxy-port': PORT},
        sequentialClientUpdate: {delay: false}
    });
});

test('the socket server starts and answers socket.io polling', async () => {
    const res = await poll('http://127.0.0.1:'+PORT+'/socket.io/?EIO=3&transport=polling');
    assert.strictEqual(res.status, 200);
    assert.match(await res.text(), /"sid"/);
});

test('pages receive the socket port', async () => {
    const body = JSON.parse((await server.inject('/_itsa_server_ajax_/props/aaa111/')).payload);
    assert.strictEqual(body.__appProps.socketport, PORT);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test --test-force-exit tests/socketserver.test.js`
Expected: FAIL — `startServer` rejects with `server.connection is not a function` (thrown by the unported constructor during registration).

- [ ] **Step 3: Port the constructor**

In `lib/socketio/socketserver.js`, inside the constructor's `if (config) { … }`, replace

```js
        instance.server = server = new Hapi.Server();
        instance._serverStartupTime = config.serverStartupTime;
        port = config.port || 4002;
        host = config.host || '0.0.0.0';
        // if PM2 is running -and in cluster-mode-, we NEED a dedicated port for each and every instance!
        port += process.env.NODE_APP_INSTANCE ? parseInt(process.env.NODE_APP_INSTANCE, 10) : 0; // see https://github.com/Unitech/PM2/issues/1510
        server.connection({
            host,
            port
        });
        instance.socketIO = SocketIO(server.listener);
        instance.socketConnections = new Map();
        instance.setupConnectionListeners();
        server.start();
        instance.setupEventListener();
```

with

```js
        port = config.port || 4002;
        host = config.host || '0.0.0.0';
        // if PM2 is running -and in cluster-mode-, we NEED a dedicated port for each and every instance!
        port += process.env.NODE_APP_INSTANCE ? parseInt(process.env.NODE_APP_INSTANCE, 10) : 0; // see https://github.com/Unitech/PM2/issues/1510
        instance.server = server = Hapi.server({
            host,
            port
        });
        instance._serverStartupTime = config.serverStartupTime;
        instance.socketIO = SocketIO(server.listener);
        instance.socketConnections = new Map();
        instance.setupConnectionListeners();
        server.start().catch(err => {
            console.error(err);
        });
        instance.setupEventListener();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test --test-force-exit tests/socketserver.test.js`
Expected: PASS, 2 tests. (If port 4791 is taken on the machine, report it; do not silently change the port.)

- [ ] **Step 5: Lint gate and commit**

Lint gate for `socketserver.js`. Add the ledger line, then:

```bash
git add lib tests docs/superpowers/plans/2026-09-24-hapi21-migration-ledger.md
git commit -m "CHANGED: socket server runs on its own hapi 21 server

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Parity with the hapi 16 snapshot

**Files:**
- Create: `tests/parity.test.js`
- Modify: only if a real regression shows up (see Step 3)

**Interfaces:**
- Consumes: `tests/parity/runner.js` (Task 1, flavor `21`), `tests/fixtures/parity-hapi16.json`.

- [ ] **Step 1: Write the parity test**

`tests/parity.test.js`:

```js
'use strict';

// Replays the parity requests on hapi 21 and compares them with the hapi 16 snapshot
// (tests/fixtures/parity-hapi16.json). Only the differences in spec §7 are allowed.

const {test} = require('node:test'),
    assert = require('node:assert'),
    fs = require('fs'),
    os = require('os'),
    path = require('path'),
    execFileSync = require('child_process').execFileSync,
    fixture = require('./helpers/fixture'),
    snapshot = require('./fixtures/parity-hapi16.json'),
    RUNNER = path.join(__dirname, 'parity', 'runner.js');

// spec §7: request name → check of the hapi 21 record instead of an equality comparison
const INTENDED_DIFFERENCES = {
    // §7.2: a thrown Boom error keeps its own status (hapi 16 answered 500)
    'act-boom': actual => {
        assert.strictEqual(actual.status, 409);
        assert.match(actual.body.preview, /Project locked/);
    },
    // §7.4: changeTtl sets the requested ttl in seconds (hapi 16 set Max-Age=0)
    'cookie-ttl': actual => {
        const cookie = actual.cookies.find(item => item.name==='itsa-props');
        assert.strictEqual(actual.status, 200);
        assert.ok(cookie && cookie.attributes.includes('max-age=600'), JSON.stringify(actual.cookies));
    }
};

// §7.1: SameSite is compared on its own
const withoutSameSite = record => Object.assign({}, record, {
    cookies: record.cookies.map(cookie => Object.assign({}, cookie, {sameSite: null}))
});

Object.keys(snapshot).forEach(configName => {
    test('parity with hapi 16: '+configName, () => {
        const outFile = path.join(os.tmpdir(), 'itsa-parity-21-'+configName+'-'+process.pid+'.json');
        let actual;
        execFileSync(process.execPath, [RUNNER, '21', configName, fixture.FIXTURE_APP, outFile], {stdio: ['ignore', 'ignore', 'inherit']});
        actual = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        fs.unlinkSync(outFile);
        Object.keys(snapshot[configName]).forEach(name => {
            const expected = snapshot[configName][name],
                got = actual[name];
            assert.ok(got, 'no hapi 21 record for '+name);
            got.cookies.forEach(cookie => {
                assert.strictEqual(cookie.sameSite, 'lax', name+': cookie '+cookie.name+' must be SameSite=Lax');
            });
            if (INTENDED_DIFFERENCES[name]) {
                INTENDED_DIFFERENCES[name](got);
            }
            else {
                assert.deepStrictEqual(withoutSameSite(got), withoutSameSite(expected), 'request '+name+' differs from hapi 16');
            }
        });
    });
});
```

- [ ] **Step 2: Run it**

Run: `node --test --test-force-exit tests/parity.test.js`
Expected: PASS, 3 tests (`plain`, `cookies`, `auth`).

- [ ] **Step 3: Handle differences (only if Step 2 fails)**

For each failing request, compare the two records (print both from the snapshot and a runner output file: `node tests/parity/runner.js 21 <config> tests/fixtures/app /tmp/out.json`). Then:
- A regression in the port (wrong status, missing header, different props): fix `lib/`, add or extend a test in the owning area's test file that pins it, re-run.
- A difference caused only by hapi/Inert/mime database versions (for example a changed `content-type` for `favicon.ico`, or an Inert `etag` format): **do not** change `lib/` to imitate hapi 16 and **do not** add it to `INTENDED_DIFFERENCES`. Stop and report the request name and both records to the controller; the user decides.

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: PASS, every test file.

- [ ] **Step 5: Commit**

Add the ledger line (note any differences found and how they were resolved), then:

```bash
git add tests docs/superpowers/plans/2026-09-24-hapi21-migration-ledger.md lib
git commit -m "ADDED: parity test against the hapi 16 snapshot

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Migration guide and release metadata

**Files:**
- Create: `MIGRATION-18.md`
- Modify: `README.md`, `package.json` (version), `package-lock.json`, `.npmignore`

**Interfaces:**
- Consumes: the final API from Tasks 2–8 (names in spec §3).

- [ ] **Step 1: Write `MIGRATION-18.md`**

Create `MIGRATION-18.md` with exactly this content:

````markdown
# Migrating an app to itsa-react-server 18 (hapi 21)

itsa-react-server 18 runs on hapi 21 (`@hapi/hapi`). hapi 17 replaced the whole API: there is no
`reply` anymore. Every handler, action, model and validate function gets the hapi toolkit `h`
instead, and **every route handler must return** its response.

Requirements: Node.js 14 or later, `@hapi/hapi` ^21.

## 1. Dependencies

```bash
npm uninstall hapi
npm install @hapi/hapi@^21 itsa-react-server@^18
```

If your app requires `boom`, `hoek`, `inert`, `vision` or `joi` itself, switch to `@hapi/boom`,
`@hapi/hoek`, `@hapi/inert`, `@hapi/vision` and `joi`.

### React 16

itsa-react-server 18 uses React 16 (React 15 made `npm install` fail against
`itsa-react-globalstate`, which needs React ≥ 16). Your app must use the same React:

```bash
npm install react@^16.14.0 react-dom@^16.14.0
```

React 16 has no `dist/` folder. If your `src/manifest.json` lists React under `external-modules`,
replace the paths (the `module` and `ref` values stay the same):

| React 15 (`file`) | React 16 (`file`) |
|---|---|
| `react/dist/react.min.js` | `react/umd/react.production.min.js` |
| `react-dom/dist/react-dom.min.js` | `react-dom/umd/react-dom.production.min.js` |
| `react-dom/dist/react-dom-server.min.js` | `react-dom/umd/react-dom-server.browser.production.min.js` |
| `react/dist/react.js` | `react/umd/react.development.js` |
| `react-dom/dist/react-dom.js` | `react-dom/umd/react-dom.development.js` |
| `react-dom/dist/react-dom-server.js` | `react-dom/umd/react-dom-server.browser.development.js` |

Component changes from React 15 to 16:
- `React.PropTypes` is gone: use the `prop-types` package.
- `React.createClass` is gone: use ES classes (or the `create-react-class` package).
- `React.DOM.*` factories are gone: use `react-dom-factories` or JSX.
- `componentWillMount`, `componentWillReceiveProps` and `componentWillUpdate` still work in 16
  but are legacy (renamed `UNSAFE_*` in later versions).
- In development the browser console may warn that `ReactDOM.render()` should be `hydrate()` for
  server-rendered markup; the page still works.

## 2. server.js

hapi 21 needs host and port when the server is created. `getServerOptions(manifest)` returns them
for the current `NODE_ENV`, merged from `manifest.environments` exactly as before.

Before (hapi 16):

```js
const Hapi = require('hapi'),
    reactServer = require('itsa-react-server'),
    manifest = require('./src/manifest.json');

const server = new Hapi.Server({connections: {router: {stripTrailingSlash: true}}});

server.register([{register: reactServer, options: manifest}], err => {
    if (err) {
        throw err;
    }
    server.start(err => {
        // ...
    });
});
```

After (hapi 21):

```js
const Hapi = require('@hapi/hapi'),
    reactServer = require('itsa-react-server'),
    manifest = require('./src/manifest.json');

const start = async () => {
    const server = Hapi.server(Object.assign(reactServer.getServerOptions(manifest), {
        router: {stripTrailingSlash: true}
    }));
    await server.register({plugin: reactServer, options: manifest});
    await server.start();
    // server.manifest, server.info.host and server.info.port work as before
};

start().catch(err => {
    console.error(err);
    process.exit(1);
});
```

`itsa-react-server/lib/gracefull-shutdown` is unchanged.

`await server.register(...)` now **rejects** when the plugin cannot start (for example a missing
`build/build-stats.json`, a broken `src/routes.js` or a missing `.cookierc`). Before, the error was
logged and the server started without (some of) its routes.

## 3. Routes: handlers must return

| hapi 16 | hapi 21 |
|---|---|
| `handler: function(request, reply) { reply.reactview('index'); }` | `handler: (request, h) => h.reactview('index')` |
| `handler: function(request, reply) { reply.action('save'); }` | `handler: (request, h) => h.action('save')` |
| `reply('no access').code(401);` | `return h.response('no access').code(401);` |
| `reply.file(path)` | `return h.file(path)` |
| `reply().redirect(url)` | `return h.redirect(url)` |

A handler that does not return fails with a 500 and the log message
`handler method did not return a value, a promise, or throw an error`.

The route key `config:` still works (hapi 21 accepts it as an alias of `options:`). Routes where hapi
parses a multipart upload need `payload: {multipart: true}`; routes with
`payload: {output: 'stream', parse: false}` are unaffected.

## 4. Toolkit decorations

| hapi 16 | hapi 21 |
|---|---|
| `reply.reactview(view, options)` | `h.reactview(view, options)` — returns a Promise of the response: `return` it |
| `reply.action(name, options)` | `h.action(name, options)` — returns a Promise of the response: `return` it |
| `reply.assets(file)` | `h.assets(file)` — `return` it |
| `reply.generateProps(view, options)` | `h.generateProps(view, options)` — Promise of props |
| `reply.setBodyDataAttr(obj)` | `h.setBodyDataAttr(obj)` |
| `reply.login(credentials, sessionCookie, ttlSec)` | `h.login(credentials, sessionCookie, ttlSec)` |
| `reply.logout()` | `h.logout()` |
| `reply.request` | `h.request` |

Cookie objects take `h` where they took `reply`:
`request.getPropsCookie().defineProps(h, props)`, `.setProps(h, props)`, `.deleteProp(h, key)`,
`.removeCookie(h)`, `.changeTtl(h, ttlSec)`, `.refreshTtl(h)`.

## 5. Actions (`src/actions/*.js`)

Signature: `(request, h, options, language, manifest)`. An action **returns** what should be sent:

- a plain value → sent as the body; returning nothing sends `{status: 'OK'}` (as before);
- a stream or buffer;
- `h.response(x).header(...).code(...)`;
- or it throws (or returns) a Boom error: `throw Boom.conflict('Project is locked')` → 409.

**404s:** with `pageNotFoundView` set in the manifest (the default manifest sets it), every Boom 404
on a path without a file extension is answered with that *page* (status 200) — also a
`Boom.notFound()` thrown by an action. To send a 404 body from an action, return
`h.response(body).code(404)`: a plain response is not a Boom error and passes through.

Before:

```js
const actionFn = async (request, reply) => {
    const stream = await createPdfStream();
    reply(stream)
        .header('Content-Disposition', 'attachment; filename="report.pdf"')
        .header('Content-Type', 'application/pdf');
};
```

After:

```js
const actionFn = async (request, h) => {
    const stream = await createPdfStream();
    return h.response(stream)
        .header('Content-Disposition', 'attachment; filename="report.pdf"')
        .header('Content-Type', 'application/pdf');
};
```

Before: `return reply({status: 'ERROR', message: 'Project not found'}).code(404);`
After: `return h.response({status: 'ERROR', message: 'Project not found'}).code(404);`

Errors: a thrown Boom error keeps its status. Any other error is logged, emits `server:error`, and
answers a generic 500 (the error message is not sent to the client). An action that still calls
`h(x)` logs `TypeError: h is not a function --> actions must return a value or h.response(...)`.

## 6. Models, general model, initial globalstate

`src/models/*.js`, `src/model-general.js` and `src/initial-globalstate.js`:
`(request, h, routeOptions, lang, manifest)` — they still return props. Rename the `reply` parameter;
replace `reply.login(...)` with `h.login(...)`.

## 7. Authentication `validateFunc`

`(request, h, authCookie)`. Return `true` to let the user in, a string to show the login view with
that message, anything else to show the login view. `reply.logout()` becomes `h.logout()`.

## 8. Behaviour changes

1. Cookies are sent with `SameSite=Lax` (hapi 21 would default to `Strict`, which makes users coming
   from a link on another site look logged out).
2. `request.url` is a WHATWG `URL`: use `request.url.pathname` and `request.url.search`;
   `request.url.path` no longer exists. `request.path` still has the language and ajax prefixes
   stripped.
3. Asset routes (`/assets/...`, `/assets-private/...`, `/assets/local/...`,
   `/assets/_itsa_server_external_modules/...`) and `h.assets()` only serve files inside their own
   directory; a request that tries to escape it (for example with an encoded `..%2F`) gets 403.
   **Versions up to 17.x let such a request read any file of the app, including `.cookierc`.**
4. The client's `cookie.changeTtl(value)` now sets the TTL; the value is in **seconds** (the server
   always treated it as seconds). Before, every call deleted the cookie.
5. Existing login cookies should keep working (same encryption format); an unreadable one is dropped
   and the user logs in again.

## 9. Finding everything to change

Run these from the app root; each hit needs a look:

```bash
grep -rn "require('hapi')\|new Hapi.Server\|server.connection(" --include=*.js . --exclude-dir=node_modules
grep -rn "server.register(\|server.start(" --include=*.js . --exclude-dir=node_modules   # callbacks → await
grep -rln "reply" src --include=*.js --include=*.jsx
grep -rn "reply\.\(reactview\|action\|assets\)(" src --include=*.js      # handlers: add `return`, use h
grep -rn "reply(" src --include=*.js                                     # direct replies: return h.response(...)
grep -rn "reply\.\(login\|logout\|request\|generateProps\|setBodyDataAttr\)" src --include=*.js
grep -rn "request\.url\.path" src --include=*.js
grep -rn "output: *'data'\|parse: *true" src --include=*.js             # uploads: maybe multipart: true
```
````

- [ ] **Step 2: Link it from the README and bump the version**

In `README.md`, directly above the `## Installation` heading, add the following section (spec §9). It is
written for maintainers of apps built on itsa-react-server, such as website-heidata:

```markdown
## Upgrading to 18.0.0

Version 18 moves from hapi 16 to **hapi 21** and from React 15 to **React 16**. It is a breaking
release: every app built on itsa-react-server needs code changes. The full guide with before/after
examples is [MIGRATION-18.md](MIGRATION-18.md); this is the checklist.

**What your app needs**

1. **Node.js 14 or later** (tested on Node 24).
2. **Dependencies:** remove `hapi`; install `@hapi/hapi@^21`, `itsa-react-server@^18`,
   `react@^16.14.0` and `react-dom@^16.14.0`. Replace `boom`/`hoek`/`inert`/`vision` with their
   `@hapi/*` packages if your app uses them directly.
3. **`src/manifest.json`:** replace `react/dist/...` and `react-dom/dist/...` paths in
   `external-modules` with the React 16 `umd/` files (table in the guide).
4. **`server.js`:** create the server with
   `Hapi.server(Object.assign(reactServer.getServerOptions(manifest), {...your options}))`, then
   `await server.register({plugin: reactServer, options: manifest})` and `await server.start()`.
   No `server.connection()`, no callbacks.
5. **Routes (`src/routes.js`):** every handler **returns** — `handler: (request, h) => h.reactview('index')`.
   A handler without `return` answers 500.
6. **`reply` becomes `h` everywhere:** route handlers, actions (`src/actions`), models
   (`src/models`, `src/model-general.js`, `src/initial-globalstate.js`) and the authentication
   `validateFunc`. `reply.reactview/action/assets/login/logout/generateProps/setBodyDataAttr`
   become the same methods on `h`; `reply.request` becomes `h.request`.
7. **Actions return their response:** `reply(stream).header(...)` becomes
   `return h.response(stream).header(...)`; a returned value is sent as before.
8. **React 15 → 16 component changes:** `React.PropTypes` and `React.createClass` are gone.
9. **Check the behaviour changes:** cookies are sent with `SameSite=Lax`; `request.url` is a
   WHATWG `URL` (use `pathname`/`search`); multipart uploads parsed by hapi need
   `payload: {multipart: true}`; a failing plugin start now makes `server.register()` reject.

**Security fix — upgrade soon.** Up to 17.x, an asset URL with an encoded `../`
(for example `/assets/..%2F..%2F..%2F..%2F.cookierc`) can read any file of the app, including the
cookie passwords in `.cookierc`. 18.0.0 confines every asset route to its own directory.
```

Keep the README's existing content below this section unchanged.

In `package.json` set `"version": "18.0.0"`, then run `npm install --package-lock-only`.

Append to `.npmignore`:

```
tests/
docs/
```

- [ ] **Step 3: Verify**

Run: `grep -c "^## Upgrading to 18.0.0" README.md` → `1`. Run: `npm test` → PASS. Run: `npm pack --dry-run 2>&1 | grep -E "tests/|docs/" ; echo "exit $?"` → no lines listed, `exit 1`. Run: `node -p "require('./package.json').version"` → `18.0.0`.

- [ ] **Step 4: Commit**

Add the ledger line, then:

```bash
git add MIGRATION-18.md README.md package.json package-lock.json .npmignore docs/superpowers/plans/2026-09-24-hapi21-migration-ledger.md
git commit -m "CHANGED: version 18.0.0 - hapi 21; ADDED: migration guide

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: End-to-end verification with real itsa-cli templates (nothing committed except the ledger)

Proves that real, webpack-built views render under Vision 7 and that `MIGRATION-18.md` is enough to migrate an app. Work only in the session scratchpad; the itsa-cli repository must stay untouched.

**Files:**
- Modify: ledger only (results)

- [ ] **Step 1: Pack this branch and copy the templates**

```bash
REPO=/Users/marco/Documents/Projects/itsa-react-server
E2E=/private/tmp/claude-501/-Users-marco-Documents-Projects-itsa-react-server/6769bfc7-735a-4e2e-b029-087f63b768c3/scratchpad/e2e
rm -rf "$E2E" && mkdir -p "$E2E"
cd "$REPO" && npm pack --pack-destination "$E2E"
for t in basic auth; do
  rsync -a --exclude node_modules /Users/marco/Documents/Projects/itsa-cli/project-templates/$t/ "$E2E/$t/"
done
git -C /Users/marco/Documents/Projects/itsa-cli status --short   # must be empty/unchanged
```

(A packed tarball, not a symlink: a symlinked package would load a second copy of React.)

- [ ] **Step 2: Prepare each template**

For `basic` and `auth` (in `$E2E/<t>`):
1. Create `.cookierc` in the format itsa-cli writes (`module.exports = {'app-authentication': '…', 'body-data-attr': '…', 'not-exposed': '…', 'props': '…'}`, each value ≥ 32 characters).
2. In `package.json` dependencies: remove `"hapi"`, add `"@hapi/hapi": "^21.4.10"`, set `"react"` and `"react-dom"` to `"^16.14.0"`, set `"itsa-react-server": "file:../itsa-react-server-18.0.0.tgz"`. Update the React `external-modules` paths in `src/manifest.json` per `MIGRATION-18.md`. The install must succeed without `--legacy-peer-deps`; if it does not, report the npm error.
3. `npm install`.
4. Migrate `server.js`, `src/routes.js` and every file `grep -rln reply src server.js` lists, **using only `MIGRATION-18.md`**. Note every place where the guide was unclear or incomplete.

- [ ] **Step 3: Build and start**

```bash
node ./node_modules/itsa-react-server/lib/build      # webpack build of the views (skip gulp uglify)
NODE_ENV=local node server.js                          # run in the background; basic listens on 3001
```

- [ ] **Step 4: Check the running app**

With `curl -s -o /dev/null -w '%{http_code}\n'` (and `-i` where headers matter), record for each template:
- `GET /` → 200, HTML containing the rendered view.
- `GET /information` (basic) → 200.
- `GET /_itsa_server_ajax_/props/<hash>/` → 200 JSON; `/comp/<hash>/` and `/css/<hash>/` → 200 (take `<hash>` from `build/build-stats.json` for view `index`).
- `GET /_itsa_server_serviceworker.js` → 200.
- `GET /assets/..%2F..%2F..%2F..%2F.cookierc` → 403 for `basic`; for `auth` the auth plugin turns every 403 into the login view (200, `x-noauth: true`). Either way the body must not contain `module.exports`.
- `auth` only: `GET /information` without a cookie → login view with `x-noauth: true`; log in through the template's login action (see `src/actions/login.js` and the login view for the request it expects) and repeat with the returned cookie → the protected view.

Stop the servers afterwards.

- [ ] **Step 5: Record the results**

Add to the ledger: per template, each check with its result, plus the list of gaps found in `MIGRATION-18.md`. If there are gaps, fix `MIGRATION-18.md`, re-run `npm test`, and commit only the guide and the ledger:

```bash
git add MIGRATION-18.md docs/superpowers/plans/2026-09-24-hapi21-migration-ledger.md
git commit -m "CHANGED: migration guide gaps found in end-to-end verification

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

If a check fails because of the plugin, stop and report it with the request, the response and the server log; do not patch around it in the template.
