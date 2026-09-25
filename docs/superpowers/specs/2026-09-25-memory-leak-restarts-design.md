# Memory leaks behind the PM2 restarts — findings and fix design

Date: 2026-09-25. Branches: `DEV-hapi21` (18.0.0, hapi 21; 18.x changes only) and a new
`DEV-17.1.0-memory-leaks` off `master` (17.1.0, hapi 16), checked out in its own folder
`/Users/marco/Documents/Projects/itsa-react-server-17.1.0` (git worktree).

## 1. Symptom

website-heidata (itsa-react-server 16.x/17.x, hapi 16) runs under PM2 in cluster mode, 3 instances,
`--max_old_space_size=3072`, `max_memory_restart: 3800M`. Workers restart "every now and then" and the
app logs show no error.

## 2. What the production log proves

`~/.pm2/pm2.log`, 2026-09-24 12:22 and 12:31:

- `FATAL ERROR: Scavenger: semi-space copy Allocation failed - process out of memory`, then
  `App [heidata:N] exited with code [0] via signal [SIGABRT]`. The V8 JS heap ran out, which is neither
  PM2's `max_memory_restart` nor a kernel OOM kill.
- Last GCs: `Scavenge 2732.7 (2483.0) -> 2732.7 (2483.0) MB, 65 ms` four times. The heap was full of
  live objects (nothing freed) and close to the 3072 MB limit.
- Worker uptime 77,342 s (about 21.5 h): about 120 MB/h of retained growth. Two workers died 10 minutes
  apart, which fits growth driven by traffic that the cluster spreads evenly.
- The message is in pm2.log and not in `heidata.error.log` because V8 writes it natively to fd 2. In
  cluster mode the workers inherit fd 2 from the PM2 daemon; the app log files only catch
  `process.stdout/stderr.write`.
- The stack format (`ReportOOMFailure(char const*, bool)`, `node::Abort()` without address) is Node 8.
  The crashed worker had started before 17.0.0 was published, so this crash is 16.x on Node 8. In
  cluster mode PM2 forks workers with the daemon's own Node binary; `nvm use 24` plus
  `pm2 restart --update-env` does not change it (`pm2 update` does).

## 3. Root causes (measured on Node 24.18.0; harnesses in the session scratchpad)

### 3.1 require-reload in find-package-version (JS heap, every page render) — 16.x, 17.x, 18.x

`lib/find-package-version.js:32` reads `<cwd>/node_modules/<pkg>/package.json` with require-reload,
which deletes the cache entry and calls `require()` again. Every call creates a new `Module`, and Node
pushes each one into the parent module's `children` array, which is never trimmed.

Callers on the request path:
- `assets-handler.js:172-174` preboot: every full page (`h.reactview` without ajax, `h.generateProps`,
  404 page, login view).
- `assets-handler.js:167-170` babel-polyfill: every full page when `babel-polyfill` is on.
- `build-props.js:111-116` socket.io-client: every page and every props request when `socketServer`
  is enabled (the default manifest enables it).

Measured on 17.x: 2.3 KB per page (fixture manifest), 6.4 KB per page (default manifest), linear, no
plateau. 18.x: 2.0 KB and 5.6 KB. With the lookup memoized every scenario was flat. The repo fixture
has no `node_modules/preboot`, so the lookup throws before creating a Module; that is why the tests
never showed it.

### 3.2 ws 6.1.4 permessage-deflate limiter stall (socket server) — Node >= 10

socket.io 2.2.0 -> engine.io 3.3.2 (perMessageDeflate on by default) -> ws 6.1.4. ws runs every
compression through one module-global limiter of 10 slots. A client that disconnects abruptly while
its message is being compressed never releases its slot (fixed in ws 7.1.2). After 10 such
disconnects every later compression waits forever and keeps its payload, WebSocket and socket alive.
Measured: +6 KB heap and +10 KB RSS per abrupt disconnect; once stalled, +4.1 MB/s with 200 clients.
Setting `perMessageDeflate: false` or using socket.io 2.5.1 (ws 7.5) was flat. Deflate also costs
about 300 KB RSS per connected browser tab.

## 4. Other defects found (not memory)

- `model-handler.js:20-24`: on Node >= 12 the MODULE_NOT_FOUND message has a
  `\nRequire stack:` suffix, so a missing `@phone`/`@tablet` model is taken for an internal error and
  logged with a full stack, 1-3 times per page. `:44-46` is a no-op cache check, so missing models are
  looked up on every request.
- `socketserver.js:133-139`: `data.props.__appProps.serverStartup` without checks; one malformed
  `clientconnected` packet throws an uncaught TypeError and kills the worker.
- hapi 16 on Node >= 16 never answers requests with a payload over real HTTP (reproduced: GET 200,
  POST no response). Since Node 16 `IncomingMessage` emits `close` once the body has been read, and
  hapi 16 (`request.js:185-192`) takes that for a client disconnect (hapijs/hapi#4298). hapi 21 is not
  affected. `server.inject` does not reproduce it.

## 5. Decisions (user, 2026-09-25)

1. Fix both lines: 18.x on `DEV-hapi21`, and 17.x on a new branch off `master`, checked out in a
   separate folder (worktree `../itsa-react-server-17.1.0`) so this folder stays on `DEV-hapi21`.
2. Socket server: `perMessageDeflate: false` **and** socket.io `^2.5.1`.
3. Also fix: the model error-log spam (and its no-op cache), the socket crash on a bad packet, and a
   17.x workaround for the hapi 16 POST hang.
4. 17.x `package-lock.json` is rebuilt, without `--legacy-peer-deps`. That needs React 15 -> 16 on
   17.x (one major step, as 18.x did in 922f70d); the release becomes **17.1.0**.
5. ESLint is fixed on both lines for all of `lib/` (minified files excluded), and `npm run lint`
   covers that scope.

## 6. Fix design

- **find-package-version:** read `package.json` with `fs.readFileSync` + `JSON.parse` (BOM stripped,
  as `require` does). No Module is created, and every call still reads the current file, so build and
  watch callers keep their behaviour. Same file on both lines.
- **Socket server:** `SocketIO(server.listener, {perMessageDeflate: false, maxHttpBufferSize})`.
  engine.io 3.6 lowers the default `maxHttpBufferSize` from 1e8 to 1e6, and `clientconnected` carries
  the page props, so the default stays 1e8 and the manifest can set
  `socketServer.maxHttpBufferSize`. Other socket.io 2.5.1 changes: `pingTimeout` 5 s -> 20 s,
  browsers get socket.io-client 2.5.0; `origins` still defaults to `*:*` (no CORS change).
- **Bad packet:** `clientconnected` without `data.props.__appProps` is ignored (not stored, no reply).
- **Model lookup:** compare only the first line of the error message; cache only "model file does
  not exist" (a model that fails to load is still retried and logged on every request, as before).
  Watch mode restarts the server on any `src/**` change, so the negative cache is safe.
- **17.x POST hang:** new `lib/hapi-plugin/helpers/request-close-fix.js`. On Node >= 16 an
  `onRequest` extension replaces hapi 16's `req 'close'` listener with a `res 'close'` listener that
  bails only when the response has not ended (what hapi >= 20.2.1 does). Registered from
  `middleware.generate`.
- **17.x React 16 and lockfile:** the only ERESOLVE on `master` is React 15 at the root against
  `itsa-react-globalstate`'s peer `react >=16` (every published globalstate version needs it).
  `react`/`react-dom` go to `^16.14.0` and `jsx-view.js` renders with `React.createElement` instead of
  the deprecated `React.createFactory` (both as on 18.x). Then a plain `npm install` rebuilds the lock
  (checked: no ERESOLVE; hapi 16.8.4 comes in as the peer dependency). The React 15 render snapshot
  from 18.x (`tests/fixtures/react15-render.json`, recorded through 17.x's jsx-view on React 15) is
  ported to prove the markup is unchanged. `npm test` on 17.x becomes node:test (`tests/*.test.js`, as
  on 18.x); the placeholder mocha test goes (mocha and chai were never installed).
- **ESLint:** `.eslintrc` names a rule removed from eslint-plugin-react (`react/wrap-multilines`, now
  `react/jsx-wrap-multilines`), so ESLint aborts on every file. Rename it, add `.eslintignore` for
  `lib/**/*.min.js`, make `npm run lint` (and 17.x's `pretest`) run `eslint ./lib`, and fix every
  error. Where a style rule contradicts the code's consistent style (e.g. `space-before-function-paren`
  `named: "always"` against methods written `name(args)` throughout), the config follows the code;
  real problems (undefined names, unused variables, useless escapes) are fixed in the code; files that
  log on purpose get the existing `/* eslint no-console: 0*/` header.

## 7. Non-goals

- website-heidata is not touched (not even read, apart from `deployment/`).
- No other refactoring (ddos `enabled` flag, user agent twice in the ddos key, `socketConnections`
  keeping full props, `stop()` throwing) — reported, not changed.

## 8. Done when

- New tests fail before and pass after each fix; full suites pass on both lines.
- The measurement harnesses show flat heap for page renders (default manifest) and flat RSS for
  abrupt socket disconnects on both lines, and a real-HTTP POST is answered on 17.1.0 with Node 24.
- `npm run lint` passes on both lines; 17.x `npm ci` works from the rebuilt lock.
