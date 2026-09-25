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
6. An empty response answers **204** instead of 200 (hapi 21's default for an empty payload). This
   hits handlers and actions such as `return h.response().header('Content-Disposition', ...)`. To keep
   200, use `.code(200)` on the response or set `response: {emptyStatusCode: 200}` in the route's
   `options`.
7. `.js` files served from the asset routes carry `Content-Type: text/javascript` instead of
   `application/javascript` (the current standard, RFC 9239). Browsers treat both the same.
8. The `props` and `body-data-attr` cookie settings in your manifest are no longer swapped. Up to
   17.x each cookie got the other one's `enabled`, `onlySsl` and `ttl-sec`. If the two blocks
   differ in your manifest, the cookies now follow their own block: check both.
9. Removing a cookie now really removes it: the client's `cookie.removeCookie()` and `h.logout()`
   inside a `validateFunc`. Up to 17.x the cookie was set again in the same response.
10. The socket server uses socket.io 2.5 (was 2.2). Browsers get socket.io-client 2.5.0 after the
    next build (served from `_itsa_server_external_modules`), a vanished client is dropped after 45 s
    instead of 30 s (`pingTimeout` 20 s), and websocket messages are no longer compressed
    (permessage-deflate leaked memory and cost about 300 KB per connected browser). A client message
    may still be 100 MB; set `socketServer.maxHttpBufferSize` (bytes) in the manifest to lower it.

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
