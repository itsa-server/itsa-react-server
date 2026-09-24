# itsa-react-server 18.0.0 — hapi 21 migration

Date: 2026-09-24
Branch: `DEV-hapi21`
Status: approved design, awaiting spec review

## 1. Goal and scope

Move itsa-react-server from hapi 16 to hapi 21 (`@hapi/hapi`) on hapi's
native API — no `reply` compatibility shim — and prove the behaviour is
unchanged apart from a short, explicit list of intended differences.

**In scope:** this repository only: the hapi plugin (`lib/hapi-plugin/`),
the socket server (`lib/socketio/socketserver.js`), package metadata,
a test suite, and a migration guide for consuming apps.

**Out of scope:** `website-heidata` and the `itsa-cli` project templates
(the maintainer migrates those, using the migration guide); the build,
watch, webpack, CDN, gulp and client-side code; babel and webpack
versions; React beyond the single step to 16 (§11); publishing to npm;
pushing or opening a PR.

**Success criteria**

1. The plugin registers and serves on `@hapi/hapi` 21.x under Node 24.
2. `npm test` passes: integration tests covering every area in §8.
3. A parity test shows hapi 21 responses match the recorded hapi 16
   responses, except for the intended differences listed in §7.
4. A real `itsa-cli` `basic` and `auth` template, built with webpack and
   running against this branch, serves pages, ajax routes, the service
   worker and the login flow (verification only, not committed).
5. `MIGRATION-18.md` lets a maintainer migrate an app without reading the
   plugin source.

## 2. Package

- Version `18.0.0`.
- `peerDependencies`: `"@hapi/hapi": "^21"` (replaces `"hapi": "^16.4.0"`).
- `engines.node`: `">=14"`.
- Dependencies replaced: `inert` → `@hapi/inert ^7`, `vision` →
  `@hapi/vision ^7`, `boom` → `@hapi/boom ^10`, `hoek` → `@hapi/hoek ^11`.
  `react` and `react-dom` → `^16.14.0` (§11). No other dependency changes.
- `npm install` must succeed **without** `--legacy-peer-deps` (§11).
- `devDependencies`: `@hapi/hapi ^21` (so tests can run); hapi 16 only as
  a temporary, uncommitted install for recording the parity snapshot (§8).
- `scripts.test`: `node --test tests/`. `main` stays
  `./lib/hapi-plugin/plugin.js`.

## 3. Public API

### 3.1 Exports of `lib/hapi-plugin/plugin.js`

```js
module.exports = {
    name: 'itsa-react-server',
    version: require('../../package.json').version,
    register: async (server, manifest) => { /* ... */ },
    getServerOptions // (manifest) => {host, port}
};
```

- `register`:
  - adds `@hapi/inert` and `@hapi/vision` only when `server.registrations`
    does not already contain them;
  - sets up views, auth, cookies, middleware, routes and the socket server;
  - calls `server.decorate('server', 'manifest', appConfig)`, so
    `server.manifest` keeps working in the app's `server.js`.
- `getServerOptions(manifest)` returns `{host, port}` resolved for
  `process.env.NODE_ENV || 'local'` through the existing
  `getManifest.generate(environment, manifest)` merge (`host` defaults to
  `'0.0.0.0'`, `port` is passed through as-is).
- `lib/gracefull-shutdown.js` keeps its API (it already awaits
  `server.stop()`).

App `server.js` after migration:

```js
const Hapi = require('@hapi/hapi'),
    reactServer = require('itsa-react-server'),
    manifest = require('./src/manifest.json');

const server = Hapi.server({
    ...reactServer.getServerOptions(manifest),
    router: {stripTrailingSlash: true}
});
await server.register({plugin: reactServer, options: manifest});
await server.start();
```

### 3.2 Toolkit decorations

Same names, moved from `reply` to the hapi toolkit `h`:

| hapi 16 | hapi 21 | returns |
|---|---|---|
| `reply.reactview(view, opts)` | `h.reactview(view, opts)` | Promise of a response |
| `reply.action(name, opts)` | `h.action(name, opts)` | Promise of a response |
| `reply.assets(file)` | `h.assets(file)` | response |
| `reply.generateProps(view, opts)` | `h.generateProps(view, opts)` | Promise of props |
| `reply.setBodyDataAttr(obj)` | `h.setBodyDataAttr(obj)` | `undefined`; stored on `request.app` |
| `reply.login(creds, session, ttl)` | `h.login(creds, session, ttl)` | `undefined`; sets the auth cookie |
| `reply.logout()` | `h.logout()` | `undefined`; unsets the auth cookie |

Request decorations are unchanged: `getAuthCookie`, `getPropsCookie`,
`getBodyDataAttrCookie`, `getNotExposedCookie`, `getClientGlobalstate`.

### 3.3 Contract for app code

- **Route handlers must return**, e.g.
  `handler: (request, h) => h.reactview('index')`. The plugin still
  registers the app's `src/routes.js` itself; the route `config:` key
  keeps working (hapi 21 still accepts it as an alias of `options:`).
- **Action**: `(request, h, options, language, appConfig)`. It returns a
  plain value (sent as the body), a stream or buffer, or
  `h.response(x).header(...).code(...)`; or it throws / returns a Boom
  error. Returning `undefined` sends `{status: 'OK'}`, as today.
- **View model, `src/model-general.js`, `src/initial-globalstate.js`**:
  `(request, h, routeOptions, lang, appConfig)`; they return props, as today.
- **Auth `validateFunc`**: `(request, h, authCookie)`. `true` lets the
  user in; a string sends them to the login view with that message;
  anything else sends them to the login view.
- `h.request` replaces `reply.request`.

## 4. Module changes

### 4.1 `lib/hapi-plugin/plugin.js`
- Exports the object in §3.1.
- Registration of Inert/Vision is conditional on `server.registrations`
  (replaces the `server.root._replier._decorations` check).
- The startup steps are awaited in the existing order; errors are rethrown
  (§6.1).
- `startupTime` stays a module variable and is passed explicitly to the
  socket server, instead of via `server.root._startupTime`.
- `plugin.register.attributes` (which used the *app's* package.json as the
  plugin name) is removed.

### 4.2 `helpers/extend-reply.js` → `helpers/extend-toolkit.js`
- Renamed, since `reply` no longer exists.
- The `server.connection()` call is removed; `server.views()` stays
  (Vision 7 still passes `filename` in the compile options, which
  `helpers/jsx-view.js` relies on).
- Decorations are registered with `server.decorate('toolkit', ...)`,
  using `function` (not arrow) so `this` is the toolkit.
- The props-building code duplicated between `reactview` and
  `generateProps` (general model, initial globalstate, view model, body
  data attributes, offline message) moves into one shared function used
  by both.
- `reactview` returns a response in every branch:

  | request | response |
  |---|---|
  | ajax component (`x-ajaxtype: comp`) | `h.response(ATTACK_SAFE_JSON + data).ttl(EXPIRE_ONE_YEAR).etag(hash)` (+ `x-noauth: true` when `__noAuth__`) |
  | ajax CSS (`x-ajaxtype: css`) | `h.response(data).ttl(EXPIRE_ONE_YEAR).etag(cssfile)` (+ `x-noauth`) |
  | ajax component/CSS for an unknown view | `h.response('file not found').code(404)` |
  | ajax props (`x-ajaxtype: props`) | `h.response(props)` (+ `x-noauth`), after refreshing cookie TTLs |
  | full page, view exists | `h.view(affinityView, props)` (+ `x-noauth`), after refreshing cookie TTLs |
  | full page, view missing | `h.file(src/file404.html).code(404)`, or `h.response().code(404)` if that file is missing |

- `setBodyDataAttr` stores a deep clone on `request.app._itsa_bodyDataAttr`
  (hapi 21 gives each lifecycle step a fresh `h`, confirmed by probe);
  the props builder reads it from there.

### 4.3 `helpers/action-handler.js`
- Returns the action's return value, or `{status: 'OK'}` when it is
  `undefined`/falsy (current rule: `value || {status: 'OK'}`).
- Removes the `reply._replied` bookkeeping.
- Error mapping per §6.2.

### 4.4 `helpers/model-handler.js`, `helpers/change-cookies.js`, `helpers/refresh-cookies.js`
- Parameter `reply` renamed to `h`; no other change.

### 4.5 `helpers/apply-server-routes.js`
- Built-in route handlers return `h.file(...)`,
  `h.redirect(favicon).permanent().rewritable()` (CDN favicon) or
  `h.response(...)`; the service-worker handler becomes `async` and
  returns `h.response(content).type(...).header('Cache-Control', ...)`.
- The `pageNotFoundView` hook: `server.ext('onPreResponse', (request, h) => ...)`
  returns `h.reactview(appConfig.pageNotFoundView)` for a 404 on an HTML
  page, else `h.continue`; it reads `request.url.pathname` instead of
  `request.url.path`.
- **Security fix (added 2026-09-25, approved by the maintainer):** every
  asset route that serves `request.params.<name>` confines the file to its
  own base directory with `h.file(name, {confine: baseDir})`. Today an
  encoded slash (`/assets/..%2F..%2F..%2F..%2F.cookierc`) escapes the
  build directory and serves any file under the app root, including the
  cookie passwords in `.cookierc`; reproduced on 17.x/hapi 16 and on a
  straight hapi 21 port. With the fix such a request gets 403. Routes:
  `/assets/{version}/{filename*}`, `/assets-private/{version}/{filename*}`,
  `/assets/_itsa_server_external_modules/{versionedmodule*}`,
  `/assets/local/{filename*}`, `/assets/{filename*}`, and the
  `h.assets(filename)` decoration.
- Routes are registered with `server.route(routes)`. `activateRoutes`,
  its 5-second timer and the no-op `routes.prefix` assignment are removed
  (no consumer uses them).

### 4.6 `helpers/middleware.js`
- `onRequest` extensions return `h.continue`.
- A DDoS block returns
  `h.response(ddosResponse.message).code(ddosResponse.statusCode).takeover()`.
- The ajax prefix (`/_itsa_server_ajax_/(comp|css|props)/<hash>`) and the
  language prefix are both stripped, then applied with a single
  `request.setUrl(newPath + request.url.search)` (the path and URL are
  read-only in hapi 21). `x-ajaxtype`, `request.affinity`,
  `request.language`, `request.locales` and `request.languageSwitch` keep
  their meaning.

### 4.7 `helpers/console-debug.js`
- `server.ext('onRequest', ...)` returning `h.continue`.

### 4.8 `helpers/apply-client-routes.js`
- Still works out each route's view by calling its handler with a stand-in
  toolkit exposing `reactview`; reads `route.options || route.config` for
  the handler and `auth`.

### 4.9 `helpers/build-props.js`
- `props.__appProps.uri` built from `request.url.pathname + request.url.search`.

### 4.10 `authentication/authentication-handler.js`
- `await server.register({plugin: authenticationPlugin, options: {...}})`,
  then `server.auth.strategy(item.strategy, 'itsa-react-server-auth', {...})`
  per configured strategy (a failing strategy is logged and skipped, as today).

### 4.11 `authentication/authentication-plugin.js`
- Shape `{name: 'itsaReactServerAuth', version: '1.0.0', register: async (server, options) => {...}}`.
- `login` and `logout` are toolkit decorations using `this.request`.
- Scheme `authenticate: async (request, h)`:
  - service-worker init request (`x-itsa-serviceworker-init: true`):
    `return h.authenticated({credentials: {scope}})`, where `scope` comes
    from `request.server.auth.lookup(request.route).access[].scope.selection[0]`
    (probe confirmed this structure);
  - `validateFunc(request, h, authCookie)` returns `true`:
    `return h.authenticated({credentials: authCookie.getProps()})`;
  - otherwise, or on an exception:
    `return (await h.reactview(loginView, {__sendRequireId__: true, __noAuth__: true, __authenticationMsg__})).takeover()`.
- The 403 → login-view redirect stays an `onPreResponse` extension,
  returning `h.reactview(loginView, {__sendRequireId__: true, __noAuth__: true})`
  or `h.continue`.

### 4.12 `cookies/cookie.js`
- `server.state(name, {...options, isSameSite: 'Lax'})`.
- `reply.state` / `reply.unstate` / `reply.request` → `h.state` /
  `h.unstate` / `h.request`.
- Bug fix: `changeTtl` tests `typeof sec` instead of `typeof ttlSec`, so
  every call sets the TTL to 0 and deletes the cookie. Fixed to
  `typeof ttlSec`. The client sends the value as the `x-ms` header
  string, so `change-cookies.js` converts it with `Number()` before the
  call. The server keeps treating it as **seconds** (its existing
  `ttlSec` parameter), even though the client method is named
  `changeTtl(ms)`; the migration guide states the unit.

### 4.13 `cookies/cookie-handler.js`
- `server.root` → `server`.

### 4.14 `lib/socketio/socketserver.js`
- `require('@hapi/hapi')`, `Hapi.server({host, port})`; socket.io attaches
  to `server.listener`; `server.start()` returns a promise whose rejection
  is logged.

## 5. Behaviour changes apps will notice

1. Cookies are sent with `SameSite=Lax` (hapi 21's default would be
   `Strict`, which makes users arriving from an external link look
   logged out; hapi 16 sent no `SameSite`, which browsers treat as Lax).
2. `request.url` is a WHATWG `URL`: use `request.url.pathname` and
   `request.url.search`; `request.url.path` no longer exists.
   `request.path` still returns the path with the language and ajax
   prefixes stripped.
3. Routes where hapi parses multipart uploads need
   `payload: {multipart: true}`; routes with
   `output: 'stream', parse: false` are unaffected.
4. Existing login cookies should still decode (the iron format is
   unchanged); if one does not, `clearInvalid` drops it and the user logs
   in again.
5. Startup errors and action errors behave as in §6.

## 6. Error handling

### 6.1 Plugin startup
- `register` rethrows any error from the startup steps (e.g. missing
  `build/build-stats.json`, broken `src/routes.js`, missing `.cookierc`),
  so `await server.register(...)` rejects and the app does not serve a
  half-configured server. Today the error is logged and the server starts
  with missing routes.
- Optional pieces keep their forgiving behaviour — logged and skipped:
  a strategy's `validateFunc` file, `src/model-general.js`,
  `src/initial-globalstate.js`, view models.

### 6.2 Actions
Every failure is logged and emits `server:error` (as today). Then:
- a thrown or returned Boom error passes through with its own status;
- a missing action file, or a module that does not export a function →
  `Boom.badImplementation('Action-file not found')` (500, same message
  as today);
- any other error → `Boom.badImplementation()` (500, no internal message
  to the client). When the error is `TypeError: h is not a function`, the
  log line adds the hint
  `actions must return a value or h.response(...)`.

### 6.3 `reactview`
- An unexpected error is logged and rethrown; hapi turns it into a 500
  (a Boom error keeps its status). Same result for the client as today.

### 6.4 Unmigrated app code (documented in the migration guide)
- A handler that does not return → hapi's 500 with the log message
  "handler method did not return a value, a promise, or throw an error".
- An action calling `h(x)` → `TypeError: h is not a function`, logged
  with the hint above, 500.

## 7. Intended differences from hapi 16

The parity test (§8.3) allows exactly these differences:

1. `Set-Cookie` headers carry `SameSite=Lax`.
2. An action throwing a Boom error responds with that error's status.
3. An action throwing a non-Boom error responds with a generic 500 body
   instead of "Action-file not found".
4. `changeTtl` sets the requested TTL instead of deleting the cookie.
5. Asset requests whose filename escapes the route's directory get 403
   instead of the file (§4.5). The parity request list contains no such
   request; this is covered by the built-in route tests.

Headers outside the recorded fields (§8.3 step 2) are not compared. Any
other difference in a recorded field is a finding to fix or report, not
something to add to this list silently.

## 8. Testing and verification

### 8.1 Setup
- Runner: Node's built-in `node:test` with `node:assert`; requests via
  `server.inject()`. No new test dependencies.
- Fixture app `tests/fixtures/app/`: `package.json`, `.cookierc`
  (passwords ≥ 32 chars), `src/manifest.json`, `src/routes.js`,
  `src/actions/*`, `src/models/*`, `src/model-general.js`,
  `src/file404.html`, and a hand-written `build/` (`build-stats.json`,
  one view component in `build/view_components/` setting
  `global.__viewComponent`, component JS/CSS under
  `build/private/assets/`, a public asset and `favicon.ico`). No webpack.
- The plugin reads `process.cwd()` at load time, so each test file
  `chdir`s into its fixture before requiring the plugin. Each fixture
  configuration (plain, auth, cookies) has its own test file; `node --test`
  runs each file in its own process.

### 8.2 Coverage

| Area | Checks |
|---|---|
| Startup | registers on hapi 21; `server.manifest` set; `getServerOptions` per `NODE_ENV`; Inert/Vision not registered twice; broken `routes.js` makes `register` reject |
| `reactview` | full HTML page (doctype + rendered markup); ajax props, component and CSS via `/_itsa_server_ajax_/…` with etag and ttl; `x-noauth`; unknown view → 404 (`file404.html` and bare); `pageNotFoundView` |
| Actions | plain value; default `{status:'OK'}`; `h.response().header().code()`; stream; Boom passthrough; missing file → 500; other throw → 500 |
| Models | view model and `model-general` merged into props; both receive `h`; `setBodyDataAttr` reaches the page |
| Middleware | `/nl/...` sets language and strips prefix; `Accept-Language`; device affinity; DDoS limit triggers |
| Auth | no cookie → login view (takeover, `x-noauth`); `h.login` sets `itsa-id` with `SameSite=Lax`; that cookie opens the route; wrong scope → 403 → login view; `h.logout`; service-worker init |
| Cookies | `x-cookie` define / set / delete / remove / ttl; `changeTtl` fix; `refreshTtl` |
| Built-in routes | favicon (local and CDN redirect); versioned and unversioned assets; service-worker JS; encoded-slash traversal on every asset route and `h.assets` → 403 |
| Socket server | starts; socket.io polling endpoint answers |

### 8.3 Parity against hapi 16
1. Before any change to `lib/`, run a scripted list of requests against
   the **current hapi 16 code**, using a hapi 16 variant of the fixture's
   routes, actions and models (`tests/fixtures/app-hapi16/src/`, same
   behaviour, `reply` style).
2. Record per request: status, `content-type`, `x-noauth`, `etag`,
   cookie names (and attributes except `SameSite`), and the body or its
   SHA-256 digest; commit as `tests/fixtures/parity-hapi16.json` together
   with the recording script.
3. `tests/parity.test.js` replays the same requests on hapi 21 and
   compares, allowing only the differences in §7.

hapi 16 is installed only temporarily for step 1 and is not committed as
a dependency.

### 8.4 End-to-end with a real build (verification only)
- Copy the `itsa-cli` `basic` and `auth` templates into the session
  scratchpad (the itsa-cli repo is not touched).
- Point their `itsa-react-server` dependency at this branch, convert their
  `server.js` and routes by hand per `MIGRATION-18.md`, run the real
  build, start the server.
- Fetch pages, the three ajax routes, the service worker, and the login
  flow. Nothing from this step is committed; results are reported.

## 9. Migration guide

`MIGRATION-18.md` at the repo root, linked from the README:
- `server.js` before/after (with `getServerOptions`);
- the "handlers must return" rule;
- actions, models, `validateFunc`, `model-general`, `initial-globalstate`
  before/after;
- the `reply.*` → `h.*` table (§3.2);
- streams and downloads: `return h.response(stream).header(...)`;
- `reply.request` → `h.request`;
- behaviour changes (§5) and error handling (§6);
- the two common startup/runtime errors (§6.4) and what they mean;
- search patterns to find every place to change: handlers without
  `return`, `reply(` calls, `reply.login`/`reply.logout`, `reply.request`,
  `request.url.path`, multipart payload routes, `new Hapi.Server`,
  `server.register(` with a callback, `server.start(` with a callback;
- React 16 (§11): bump the app's own `react`/`react-dom`, replace
  `react/dist/...` paths in the app manifest's `external-modules`, and the
  React 15 → 16 component changes (`React.PropTypes`, `React.createClass`
  removed; `componentWill*` legacy).

`README.md` gets an "Upgrading to 18.0.0" section (added 2026-09-25 at the
maintainer's request) that tells a consuming app such as website-heidata,
in a short checklist, everything the upgrade takes — Node and
`@hapi/hapi` versions, React 16, `server.js`, handlers must return,
`reply` → `h` in actions/models/validate, manifest `external-modules`
paths, the behaviour changes and the security fix — and links to
`MIGRATION-18.md` for the before/after details.

## 10. Delivery
- All work committed on `DEV-hapi21`; version bumped to `18.0.0`.
- No npm publish, push or PR unless the maintainer asks.

## 11. React 16 (added 2026-09-25, approved by the maintainer)

Why: a plain `npm install` fails (ERESOLVE) because `itsa-react-globalstate`
requires `react >= 16` while the package pins React 15. The maintainer asked
to upgrade React one major step at a time until install works; React 16 is
the first step and the only constraint found requires `>= 16`.

- `react`, `react-dom` → `^16.14.0`. The lockfile is regenerated with a
  plain `npm install`. If it still fails because something requires a newer
  React, take the next major step (17, then 18) and record why; any other
  failure is reported, not forced.
- `lib/hapi-plugin/helpers/jsx-view.js`: `React.createFactory` (deprecated,
  warns in 16.13+) → `React.createElement(Component, context)`; same output.
- `lib/default-manifest.json` `external-modules`: React 16 has no `dist/`
  folder. Replace the nine `react/dist/...` / `react-dom/dist/...` paths
  with the 16 `umd/` files — production:
  `react/umd/react.production.min.js`,
  `react-dom/umd/react-dom.production.min.js`,
  `react-dom/umd/react-dom-server.browser.production.min.js`; `local` and
  `development`: `react/umd/react.development.js`,
  `react-dom/umd/react-dom.development.js`,
  `react-dom/umd/react-dom-server.browser.development.js`. Globals
  (`React`, `ReactDOM`, `ReactDOMServer`) unchanged.
- Not changed: `lib/client-controller.js` keeps `ReactDOM.render` (still
  takes over server markup in 16; only a development-console warning).
- Verification: the fixture views rendered through `jsx-view` produce
  byte-identical HTML on React 15 (recorded before the upgrade) and React 16
  (a committed test), and the startup tests still pass.

