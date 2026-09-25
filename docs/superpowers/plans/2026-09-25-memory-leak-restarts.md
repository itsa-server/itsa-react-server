# Memory leaks behind the PM2 restarts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the JS-heap growth that makes PM2 workers die (`FATAL ERROR ... out of memory`, SIGABRT), fix the related defects found, and make ESLint work, on 18.x (`DEV-hapi21`) and in a 17.1.0 (`DEV-17.1.0-memory-leaks` off `master`).

**Architecture:** Two root causes: `lib/find-package-version.js` re-requires a `package.json` on every page render (one leaked `Module` per call), and the socket server runs ws 6.1.4 with permessage-deflate, whose compression limiter stalls for good after abrupt disconnects. The fix reads `package.json` with `fs`, disables websocket compression and moves to socket.io 2.5.1. Also: the model lookup stops logging missing affinity models as errors on Node >= 12, a malformed socket message no longer throws, ESLint runs over all of `lib/`, and 17.x gets React 16 (so its lockfile rebuilds without `--legacy-peer-deps`) plus a shim so hapi 16 answers requests with a payload on Node >= 16.

**Tech Stack:** Node 24.18.0, node:test, ESLint 4.19 (babel-eslint 7, eslint-plugin-react 7), hapi 21 (`@hapi/hapi`, 18.x) / hapi 16.8.4 (17.x), React 16.14, socket.io 2.5.1 (engine.io 3.6, ws 7.5), socket.io-client 2.5.0.

**Spec:** `docs/superpowers/specs/2026-09-25-memory-leak-restarts-design.md`

## Global Constraints

- ALWAYS use curly brackets for `if`/`else`/`for`/`while` bodies, also for one-liners (user rule).
- Match the surrounding style: 4-space indent, single quotes, comma-separated `const`/`let` declarations, the existing file headers and `/* eslint ... */` comments; tests start with `'use strict';` and a short comment saying what they guard.
- 17.x library code (`lib/` on `DEV-17.1.0-memory-leaks`) must run on Node >= 8 (`engines: ">=8"`): no optional chaining, no `??`. 18.x library code: Node >= 14. Tests only run on Node 24 and may use modern Node APIs.
- Never use `npm ... --legacy-peer-deps` or `--force` (standing user rule). If npm fails with ERESOLVE, stop and report.
- Never read or touch `/Users/marco/Documents/Projects/website-heidata`.
- Branches: `DEV-hapi21` gets 18.x changes only (Part A). 17.x changes go only to `DEV-17.1.0-memory-leaks` (Part B), created from `master` and checked out in its own folder `/Users/marco/Documents/Projects/itsa-react-server-17.1.0` (a git worktree; the main folder stays on `DEV-hapi21`). That folder must NOT be inside `/Users/marco/Documents/Projects/itsa-react-server`: Node resolves `require()` through parent directories and would load 18.x's `node_modules`.
- Commit per task on the task's branch; never push, never publish. Message style: `FIXED: ...` / `CHANGED: ...` / `ADDED: ...` (first line), then a short body, then the line `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- 18.x: run tests with `npm test` from `/Users/marco/Documents/Projects/itsa-react-server` (node:test, one process per file). A single file: `node --test --test-force-exit tests/<file>.test.js`.
- 17.x: after Task 6, `npm test` in the worktree runs node:test over `tests/*.test.js`; after Task 7 its `pretest` runs ESLint first. A single file: `node --test --test-force-exit tests/<file>.test.js`.
- ESLint: broken until Task 5 (18.x) / Task 7 (17.x) (`Definition for rule 'react/wrap-multilines' was not found`). After those tasks `npm run lint` must stay at 0 problems on that branch for every later task.
- Test ports in use: 4791, 4794 (18.x). New: 4796, 4797, 4798 (18.x); 4801, 4802, 4803 (17.x).
- The code snippets below were written against the current code. If an earlier task (ESLint) reformatted the lines around a snippet, apply the same change to the reformatted lines; the behaviour must be exactly what the snippet does.

## Review Focus

- A `package.json` that starts with a UTF-8 byte order mark must still give its version (`require()` stripped the BOM) — test in Tasks 1 and 8.
- A `clientconnected` message larger than engine.io 3.6's 1 MB default must still be accepted (it carries the page props) — test in Tasks 2 and 9.
- Several POSTs over one keep-alive connection on hapi 16 + Node 24 must all be answered — test in Task 11.
- A model that fails to load (missing dependency, syntax error) must still be logged on every request, not silently cached away — test in Tasks 4 and 10.
- On 17.x with React 16, server-rendered markup must equal what React 15 produced (escaping included), and the React UMD files the manifest points at must exist — tests in Task 6.

---

## Part A — 18.x on branch `DEV-hapi21` (repo `/Users/marco/Documents/Projects/itsa-react-server`)

### Task 1: find-package-version reads package.json without require

**Files:**
- Modify: `lib/find-package-version.js` (whole file below)
- Create: `tests/find-package-version.test.js`
- Create: `tests/page-render-leak.test.js`

**Interfaces:**
- Consumes: `tests/helpers/fixture.js` exports `REPO`, `FIXTURE_APP`, `useFixture(configName, appDir)`, `buildManifest(appDir, configName, extraOverrides)`.
- Produces: `getVersion(module?: string): string` in `lib/find-package-version.js`, unchanged signature and results.

- [ ] **Step 1: Write the failing unit test** — `tests/find-package-version.test.js`:

```js
'use strict';

// getVersion() runs on every page render (assets-handler, build-props): it must read package.json
// without keeping anything. With require-reload every call left one Module in module.children.

const {test, before, after} = require('node:test'),
    assert = require('node:assert'),
    fs = require('fs'),
    path = require('path'),
    REPO = path.resolve(__dirname, '..'),
    APP = fs.mkdtempSync(path.join(REPO, 'tests', 'fixtures', '.tmp-fpv-'));

let findPackageVersion, fpvModule;

const writePackage = (dir, content) => {
    fs.mkdirSync(path.join(APP, dir), {recursive: true});
    fs.writeFileSync(path.join(APP, dir, 'package.json'), content);
};

before(() => {
    writePackage('', JSON.stringify({name: 'app', version: '3.2.1'}));
    writePackage('node_modules/some-package', JSON.stringify({name: 'some-package', version: '1.2.3'}));
    writePackage('node_modules/bom-package', '\uFEFF'+JSON.stringify({name: 'bom-package', version: '7.0.0'}));
    writePackage('externals/external-package', JSON.stringify({name: 'external-package', version: '4.5.6'}));
    // find-package-version reads process.cwd() when it loads
    process.chdir(APP);
    findPackageVersion = require('../lib/find-package-version');
    fpvModule = require.cache[require.resolve('../lib/find-package-version')];
});

after(() => {
    process.chdir(REPO);
    fs.rmSync(APP, {recursive: true, force: true});
});

test('reads the version of an installed package, also for a file inside it', () => {
    assert.strictEqual(findPackageVersion.getVersion('some-package'), '1.2.3');
    assert.strictEqual(findPackageVersion.getVersion('some-package/dist/some.js'), '1.2.3');
});

test('reads a package.json that starts with a byte order mark', () => {
    assert.strictEqual(findPackageVersion.getVersion('bom-package'), '7.0.0');
});

test('falls back to externals/', () => {
    assert.strictEqual(findPackageVersion.getVersion('external-package'), '4.5.6');
});

test('without a module it reads the app itself', () => {
    assert.strictEqual(findPackageVersion.getVersion(), '3.2.1');
});

test('a missing package gives 0.0.1 and a warning', () => {
    const originalWarn = console.warn,
        warnings = [];
    console.warn = (...args) => warnings.push(args);
    try {
        assert.strictEqual(findPackageVersion.getVersion('missing-package'), '0.0.1');
    }
    finally {
        console.warn = originalWarn;
    }
    assert.deepStrictEqual(warnings, [['Package', 'missing-package', 'seems not to be installed']]);
});

test('a changed package.json is read again', () => {
    writePackage('node_modules/changing-package', JSON.stringify({version: '1.0.0'}));
    assert.strictEqual(findPackageVersion.getVersion('changing-package'), '1.0.0');
    writePackage('node_modules/changing-package', JSON.stringify({version: '1.0.1'}));
    assert.strictEqual(findPackageVersion.getVersion('changing-package'), '1.0.1');
});

test('repeated lookups keep no modules', () => {
    const childrenBefore = fpvModule.children.length;
    for (let i = 0; i<1000; i++) {
        findPackageVersion.getVersion('some-package');
    }
    assert.strictEqual(fpvModule.children.length, childrenBefore);
    assert.deepStrictEqual(Object.keys(require.cache).filter(file => file.startsWith(APP)), []);
});
```

- [ ] **Step 2: Write the failing end-to-end test** — `tests/page-render-leak.test.js`:

```js
'use strict';

// Rendering pages must keep nothing per request. The find-package-version leak only shows when the
// app has preboot, socket.io-client and babel-polyfill in its node_modules, as an npm-installed app
// has; the plain fixture has not, so this test renders from a copy that does.

const {test, before, after} = require('node:test'),
    assert = require('node:assert'),
    fs = require('fs'),
    path = require('path'),
    fixture = require('./helpers/fixture'),
    TMP_APP = path.join(fixture.REPO, 'tests', 'fixtures', '.tmp-app-leak-'+process.pid),
    PORT = 4796;

let server;

const addPackage = name => {
    const dir = path.join(TMP_APP, 'node_modules', name);
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({name, version: '9.9.9'}));
};

// every Module object the module system holds on to
const countModules = () => Object.values(require.cache).reduce((total, mod) => total + 1 + mod.children.length, 0);

before(async () => {
    let appDir, Hapi, plugin, manifest;
    fs.cpSync(fixture.FIXTURE_APP, TMP_APP, {recursive: true, filter: src => path.basename(src)!=='node_modules'});
    addPackage('preboot');
    addPackage('socket.io-client');
    addPackage('babel-polyfill');
    appDir = fixture.useFixture('plain', TMP_APP);
    Hapi = require('@hapi/hapi');
    plugin = require(fixture.REPO);
    manifest = fixture.buildManifest(appDir, 'plain', {
        'babel-polyfill': true,
        socketServer: {enabled: true, host: '127.0.0.1', port: PORT, 'proxy-port': PORT}
    });
    server = Hapi.server(plugin.getServerOptions(manifest));
    await server.register({plugin, options: manifest});
    await server.initialize();
});

after(() => {
    process.chdir(fixture.REPO);
    fs.rmSync(TMP_APP, {recursive: true, force: true});
});

test('the app copy resolves the package versions, so the lookups really run', async () => {
    const res = await server.inject('/_itsa_server_ajax_/props/aaa111/'),
        props = JSON.parse(res.payload);
    assert.match(props.__appProps.external_js_links.join(' '), /_itsa_server_external_modules\/9\.9\.9\//);
});

test('full pages and props requests keep no modules per request', async () => {
    let modulesBefore;
    const render = async () => {
        assert.strictEqual((await server.inject('/')).statusCode, 200);
        assert.strictEqual((await server.inject('/_itsa_server_ajax_/props/aaa111/')).statusCode, 200);
    };
    for (let i = 0; i<5; i++) {
        await render(); // warm up: views, models and caches load once
    }
    modulesBefore = countModules();
    for (let i = 0; i<200; i++) {
        await render();
    }
    assert.strictEqual(countModules(), modulesBefore);
});
```

- [ ] **Step 3: Run both tests and see them fail**

Run: `node --test --test-force-exit tests/find-package-version.test.js tests/page-render-leak.test.js`
Expected: `repeated lookups keep no modules` FAILS (children grew by 1000), `full pages and props requests keep no modules per request` FAILS (about +800 modules). The other tests pass.

- [ ] **Step 4: Implement** — replace everything below the license header of `lib/find-package-version.js` (keep lines 1-10: the header comment and `/* eslint no-empty: 0*/`) with:

```js
// package.json is read with fs, not with require(): getVersion() runs on every page render, and
// require-reload left a new Module in this module's `children` on every call (a memory leak)
const fs = require('fs'),
    cwd = process.cwd(),
    path = require('path'),
    BOM = /^\uFEFF/;

// the parsed package.json, or undefined when the file is missing or unreadable
const readPackage = file => {
    let packageInfo;
    try {
        packageInfo = JSON.parse(fs.readFileSync(file, 'utf8').replace(BOM, ''));
    }
    catch (err) {}
    return packageInfo;
};

const getVersion = module => {
    let nodedir, externalsdir, packageInfo, indexSlash;
    if (!module) {
        // take main app
        module = '';
        nodedir = '';
    }
    else {
        indexSlash = module.indexOf('/');
        if (indexSlash!==-1) {
            module = module.substr(0, indexSlash);
        }
        nodedir = 'node_modules';
        externalsdir = 'externals';
    }
    packageInfo = readPackage(path.resolve(cwd, nodedir, module, 'package.json'));
    if (!packageInfo && externalsdir) {
        // file not found -> try `externals`
        packageInfo = readPackage(path.resolve(cwd, externalsdir, module, 'package.json'));
    }
    if (!packageInfo) {
        console.warn('Package', module, 'seems not to be installed');
        packageInfo = {
            version: '0.0.1'
        };
    }
    return packageInfo.version;
};

module.exports = {
    getVersion
};
```

- [ ] **Step 5: Run the two files, then the whole suite**

Run: `node --test --test-force-exit tests/find-package-version.test.js tests/page-render-leak.test.js` → all PASS.
Run: `npm test` → all PASS (75 existing tests plus the new ones).
Run: `git status --short` → no `tests/fixtures/.tmp-*` left behind.

- [ ] **Step 6: Commit**

```bash
git add lib/find-package-version.js tests/find-package-version.test.js tests/page-render-leak.test.js
git commit -m "FIXED: memory leak on every page render (find-package-version)

getVersion() re-required <cwd>/node_modules/<package>/package.json through require-reload on every
full page (preboot, babel-polyfill) and every page and props request with the socket server on
(socket.io-client). Every call left a new Module in module.children: 2-6 KB per page, until the
worker died with 'out of memory'. package.json is now read with fs.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: socket server on socket.io 2.5.1 without websocket compression

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)
- Modify: `lib/socketio/socketserver.js:23-28` (constants) and `:64` (`SocketIO(...)`)
- Modify: `lib/hapi-plugin/plugin.js:84-89` (`SocketServer.start({...})`)
- Create: `tests/socketserver-transport.test.js`
- Modify: `tests/socketserver.test.js` (manifest override + one test)
- Modify: `MIGRATION-18.md` (section `## 8. Behaviour changes`, new item 10)

**Interfaces:**
- Consumes: `SocketServer.start(config)`, `SocketServer.getSocketServer()` from `lib/socketio/socketserver.js`; `getSocketServer().socketIO.eio` is engine.io's server (`maxHttpBufferSize` property).
- Produces: `config.maxHttpBufferSize` (bytes, optional) on `SocketServer.start`; manifest key `socketServer.maxHttpBufferSize`. Task 3 reuses the connect/waitFor/listening helpers shape.

- [ ] **Step 1: Write the failing transport test** — `tests/socketserver-transport.test.js`:

```js
'use strict';

// Transport settings of the socket server (socket.io 2.5 / engine.io 3.6 / ws 7): websocket messages
// are not compressed (permessage-deflate leaked memory), large client messages are still accepted,
// and socket.io-client 2.x still connects.

const {test, before, after} = require('node:test'),
    assert = require('node:assert'),
    http = require('http'),
    path = require('path'),
    ioClient = require('socket.io-client'),
    SocketServer = require('../lib/socketio/socketserver'),
    PORT = 4797,
    STARTUP = 1234567890;

const clients = [];

const connect = () => {
    const client = ioClient('http://127.0.0.1:'+PORT, {transports: ['websocket'], forceNew: true, reconnection: false});
    clients.push(client);
    return client;
};

// resolves with the event's first argument, rejects after `ms`
const waitFor = (emitter, event, ms) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no '+event+' within '+ms+' ms')), ms);
    emitter.once(event, value => {
        clearTimeout(timer);
        resolve(value);
    });
});

const listening = async () => {
    let lastError;
    for (let attempt = 0; attempt<30; attempt++) {
        try {
            return await fetch('http://127.0.0.1:'+PORT+'/socket.io/?EIO=3&transport=polling');
        }
        catch (err) {
            lastError = err;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    throw lastError;
};

before(async () => {
    SocketServer.start({host: '127.0.0.1', port: PORT, serverStartupTime: STARTUP});
    await listening();
});

after(() => {
    clients.forEach(client => client.close());
});

test('a websocket upgrade does not negotiate permessage-deflate', async () => {
    const res = await new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1',
            port: PORT,
            path: '/socket.io/?EIO=3&transport=websocket',
            headers: {
                Connection: 'Upgrade',
                Upgrade: 'websocket',
                'Sec-WebSocket-Version': '13',
                'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
                'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits'
            }
        });
        req.on('upgrade', (response, socket) => {
            socket.destroy();
            resolve(response);
        });
        req.on('response', response => reject(new Error('no upgrade, status '+response.statusCode)));
        req.on('error', reject);
        req.end();
    });
    assert.strictEqual(res.statusCode, 101);
    assert.strictEqual(res.headers['sec-websocket-extensions'], undefined);
});

test('socket.io uses a ws without the stalled-compression bug (ws >= 7.1.2)', () => {
    const socketIoDir = path.dirname(require.resolve('socket.io/package.json')),
        engineIoDir = path.dirname(require.resolve('engine.io/package.json', {paths: [socketIoDir]})),
        version = require(require.resolve('ws/package.json', {paths: [engineIoDir]})).version,
        parts = version.split('.').map(Number);
    assert.ok((parts[0]>7) || ((parts[0]===7) && ((parts[1]>1) || ((parts[1]===1) && (parts[2]>=2)))), 'engine.io uses ws '+version);
});

test('without a manifest value a client message may be up to 100 MB', () => {
    assert.strictEqual(SocketServer.getSocketServer().socketIO.eio.maxHttpBufferSize, 1e8);
});

test('socket.io-client connects and hears that the server restarted', async () => {
    const client = connect();
    await waitFor(client, 'connect', 5000);
    client.emit('clientconnected', {props: {__appProps: {serverStartup: STARTUP-1}}});
    await waitFor(client, 'versionchanged', 5000);
});

test('a clientconnected message larger than 1 MB is accepted', async () => {
    const client = connect();
    await waitFor(client, 'connect', 5000);
    client.emit('clientconnected', {props: {__appProps: {serverStartup: STARTUP-1}, model: 'x'.repeat(2*1024*1024)}});
    await waitFor(client, 'versionchanged', 5000);
});
```

- [ ] **Step 2: Add the manifest test to `tests/socketserver.test.js`** — in `before()`, change the `socketServer` override to `{enabled: true, host: '127.0.0.1', port: PORT, 'proxy-port': PORT, maxHttpBufferSize: 5000000}`, and append:

```js
test('the manifest sets the largest client message (socketServer.maxHttpBufferSize)', () => {
    const SocketServer = require('../lib/socketio/socketserver');
    assert.strictEqual(SocketServer.getSocketServer().socketIO.eio.maxHttpBufferSize, 5000000);
});
```

- [ ] **Step 3: Run and see them fail**

Run: `node --test --test-force-exit tests/socketserver-transport.test.js tests/socketserver.test.js`
Expected FAIL: `a websocket upgrade does not negotiate permessage-deflate` (header is `permessage-deflate`), `socket.io uses a ws without the stalled-compression bug` (ws 6.1.4), `the manifest sets the largest client message` (1e8, not 5000000). The others pass.

- [ ] **Step 4: Upgrade socket.io**

Run: `npm install 'socket.io@^2.5.1' --no-audit --no-fund` (no `--legacy-peer-deps`/`--force`; on ERESOLVE stop and report).
Check: `npm ls socket.io engine.io socket.io-client` shows socket.io 2.5.1, engine.io 3.6.x, socket.io-client 2.5.0; `package.json` has `"socket.io": "^2.5.1"`.

- [ ] **Step 5: Implement** — `lib/socketio/socketserver.js`, replace

```js
    later = require('itsa-utils').later,
    SEQUENTIAL_CLIENT_UPDATE_DELAY = 2000; // not too often: give the clients time to refresh and queue any server-changes
```

with

```js
    later = require('itsa-utils').later,
    SEQUENTIAL_CLIENT_UPDATE_DELAY = 2000, // not too often: give the clients time to refresh and queue any server-changes
    // largest message a client may send, in bytes: `clientconnected` carries the page's props, so keep
    // the 100 MB of engine.io 3.3 instead of the 1 MB default of engine.io 3.6
    DEF_MAX_HTTP_BUFFER_SIZE = 1e8;
```

and replace `instance.socketIO = SocketIO(server.listener);` with

```js
        instance.socketIO = SocketIO(server.listener, {
            // no websocket compression: every connection kept its own zlib context (about 300 KB),
            // and with ws < 7.1.2 a client that disconnected during a compression stalled all later
            // ones, which then stayed in memory for good
            perMessageDeflate: false,
            maxHttpBufferSize: config.maxHttpBufferSize || DEF_MAX_HTTP_BUFFER_SIZE
        });
```

In `lib/hapi-plugin/plugin.js` `startSocketServer`, make the call:

```js
        SocketServer.start({
            host,
            port,
            serverStartupTime: startupTime,
            sequentialClientUpdate: appConfig.sequentialClientUpdate,
            maxHttpBufferSize: appConfig.socketServer.maxHttpBufferSize
        });
```

- [ ] **Step 6: Document** — in `MIGRATION-18.md`, `## 8. Behaviour changes`, after item 9 add:

```markdown
10. The socket server uses socket.io 2.5 (was 2.2). Browsers get socket.io-client 2.5.0 after the
    next build (served from `_itsa_server_external_modules`), a vanished client is dropped after 45 s
    instead of 30 s (`pingTimeout` 20 s), and websocket messages are no longer compressed
    (permessage-deflate leaked memory and cost about 300 KB per connected browser). A client message
    may still be 100 MB; set `socketServer.maxHttpBufferSize` (bytes) in the manifest to lower it.
```

- [ ] **Step 7: Run the files, then the suite**

Run: `node --test --test-force-exit tests/socketserver-transport.test.js tests/socketserver.test.js` → all PASS.
Run: `npm test` → all PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json lib/socketio/socketserver.js lib/hapi-plugin/plugin.js tests/socketserver-transport.test.js tests/socketserver.test.js MIGRATION-18.md
git commit -m "FIXED: socket server memory leak - socket.io 2.5.1, no websocket compression

socket.io 2.2.0 ran ws 6.1.4 with permessage-deflate on. A client that disconnected during a
compression never freed its slot in ws's zlib limiter (10 slots, module-global); after 10 of them
every later message and its socket stayed in memory for good. Compression is off now (it also cost
about 300 KB per connection) and ws is 7.5. maxHttpBufferSize stays 1e8 (engine.io 3.6 defaults to
1e6, too small for clientconnected with the page props); the manifest can set
socketServer.maxHttpBufferSize.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: a malformed `clientconnected` message no longer crashes the process

**Files:**
- Modify: `lib/socketio/socketserver.js` (`setupConnectionListeners`, the `clientconnected` handler)
- Create: `tests/socketserver-bad-packet.test.js`

**Interfaces:**
- Consumes: `SocketServer.start`, `getSocketServer().socketConnections` (a `Map` socket -> data).
- Produces: nothing new.

- [ ] **Step 1: Write the failing test** — `tests/socketserver-bad-packet.test.js`:

```js
'use strict';

// A clientconnected message without props threw inside socket.io's event dispatch
// (data.props.__appProps): an uncaught exception that ended the whole worker.

const {test, before, after} = require('node:test'),
    assert = require('node:assert'),
    ioClient = require('socket.io-client'),
    SocketServer = require('../lib/socketio/socketserver'),
    PORT = 4798,
    STARTUP = 1234567890;

const clients = [];

const connect = () => {
    const client = ioClient('http://127.0.0.1:'+PORT, {transports: ['websocket'], forceNew: true, reconnection: false});
    clients.push(client);
    return client;
};

// resolves with the event's first argument, rejects after `ms`
const waitFor = (emitter, event, ms) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no '+event+' within '+ms+' ms')), ms);
    emitter.once(event, value => {
        clearTimeout(timer);
        resolve(value);
    });
});

const listening = async () => {
    let lastError;
    for (let attempt = 0; attempt<30; attempt++) {
        try {
            return await fetch('http://127.0.0.1:'+PORT+'/socket.io/?EIO=3&transport=polling');
        }
        catch (err) {
            lastError = err;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    throw lastError;
};

before(async () => {
    SocketServer.start({host: '127.0.0.1', port: PORT, serverStartupTime: STARTUP});
    await listening();
});

after(() => {
    clients.forEach(client => client.close());
});

test('malformed clientconnected messages are ignored and the server keeps working', async () => {
    const client = connect();
    await waitFor(client, 'connect', 5000);
    [null, 'text', 42, [], {}, {props: null}, {props: 'text'}, {props: {}}, {props: {__appProps: null}}].forEach(data => {
        client.emit('clientconnected', data);
    });
    // handled in order: this answer means every message above was handled without a crash
    client.emit('clientconnected', {props: {__appProps: {serverStartup: STARTUP-1}}});
    await waitFor(client, 'versionchanged', 5000);
    assert.strictEqual(SocketServer.getSocketServer().socketConnections.size, 1);
});
```

- [ ] **Step 2: Run and see it fail**

Run: `node --test --test-force-exit tests/socketserver-bad-packet.test.js`
Expected: FAIL with `TypeError: Cannot read properties of null (reading 'props')` (uncaught).

- [ ] **Step 3: Implement** — in `setupConnectionListeners`, replace the `clientconnected` handler with:

```js
            socket.on('clientconnected', data => {
                // a client sends its props: ignore anything else, a bad message must not crash the process
                const appProps = data && data.props && data.props.__appProps;
                if (!appProps) {
                    return;
                }
                instance.socketConnections.set(socket, data);
                // if the client has a different version, then send a signal to refresh the page
                if (appProps.serverStartup!==instance._serverStartupTime) {
                    // inform the client to relaod the page
                    socket.emit('versionchanged');
                }
            });
```

- [ ] **Step 4: Run the file, then the suite** — `node --test --test-force-exit tests/socketserver-bad-packet.test.js` → PASS; `npm test` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/socketio/socketserver.js tests/socketserver-bad-packet.test.js
git commit -m "FIXED: a malformed clientconnected socket message crashed the process

data.props.__appProps was read without checks inside socket.io's event dispatch, so a message
without props threw an uncaught TypeError. Such messages are ignored now.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: missing affinity models are not logged as errors, and are looked up once

**Files:**
- Modify: `lib/hapi-plugin/helpers/model-handler.js:20-24` and `:44-58`
- Create: `tests/model-handler.test.js`

**Interfaces:**
- Consumes: `merge(request, h, props, routeOptions, appConfig, view)` from `lib/hapi-plugin/helpers/model-handler.js` (reads `props.__appProps.device` and `.lang`, `appConfig.debug`; calls `console.debug(request, ...)` when a model is found).
- Produces: nothing new.

- [ ] **Step 1: Write the failing test** — `tests/model-handler.test.js`:

```js
'use strict';

// Models are looked up per affinity: <view>@phone, <view>@tablet, <view>. A missing level is normal
// and must not be logged (on Node >= 12 it was: the MODULE_NOT_FOUND message got a "Require stack"),
// and is looked up only once. A model that fails to load must still be reported every time.

const {test, before, after, beforeEach} = require('node:test'),
    assert = require('node:assert'),
    fs = require('fs'),
    path = require('path'),
    Module = require('module'),
    REPO = path.resolve(__dirname, '..'),
    APP = fs.mkdtempSync(path.join(REPO, 'tests', 'fixtures', '.tmp-models-')),
    originalError = console.error,
    originalDebug = console.debug,
    originalLoad = Module._load;

let modelHandler, errors, loads;

const writeModel = (name, code) => {
    fs.writeFileSync(path.join(APP, 'src', 'models', name+'.js'), code);
};

const merge = async (view, device) => {
    const props = {__appProps: {device, lang: 'en'}};
    await modelHandler.merge({query: {}, params: {}, payload: null}, {}, props, {}, {debug: false}, view);
    return props;
};

before(() => {
    fs.mkdirSync(path.join(APP, 'src', 'models'), {recursive: true});
    writeModel('desktop-only', 'module.exports = () => ({fromModel: \'desktop-only\'});\n');
    writeModel('broken', 'require(\'itsa-no-such-module\');\nmodule.exports = () => ({});\n');
    writeModel('syntax-error', 'module.exports = (;\n');
    // model-handler reads process.cwd() when it loads
    process.chdir(APP);
    modelHandler = require('../lib/hapi-plugin/helpers/model-handler');
    console.error = (...args) => errors.push(args);
    console.debug = () => {};
    Module._load = function(request) {
        if (request.indexOf('/src/models/')!==-1) {
            loads.push(request);
        }
        return originalLoad.apply(this, arguments);
    };
});

beforeEach(() => {
    errors = [];
    loads = [];
});

after(() => {
    console.error = originalError;
    console.debug = originalDebug;
    Module._load = originalLoad;
    process.chdir(REPO);
    fs.rmSync(APP, {recursive: true, force: true});
});

test('a phone page with only a desktop model uses it and logs nothing', async () => {
    const props = await merge('desktop-only', 'phone');
    assert.strictEqual(props.fromModel, 'desktop-only');
    assert.deepStrictEqual(errors, []);
});

test('a view without any model logs nothing', async () => {
    await merge('no-model', 'tablet');
    assert.deepStrictEqual(errors, []);
});

test('a model that does not exist is looked up only once', async () => {
    let firstLoads;
    await merge('never-there', 'phone');
    firstLoads = loads.length;
    await merge('never-there', 'phone');
    await merge('never-there', 'phone');
    assert.strictEqual(firstLoads, 3);
    assert.strictEqual(loads.length, firstLoads);
});

test('a model that fails to load is reported on every request', async () => {
    await merge('broken', 'phone');
    await merge('broken', 'phone');
    await merge('syntax-error', 'phone');
    assert.strictEqual(errors.length, 3);
    assert.match(errors[0][0].message, /itsa-no-such-module/);
    assert.match(errors[1][0].message, /itsa-no-such-module/);
    assert.ok(errors[2][0] instanceof SyntaxError);
});
```

- [ ] **Step 2: Run and see it fail**

Run: `node --test --test-force-exit tests/model-handler.test.js`
Expected: the first three tests FAIL (2, 3 and 9 logged errors/loads instead of 0/3); the fourth FAILS too (9 errors instead of 3, because the missing `@phone`/`@tablet` levels are logged as well).

- [ ] **Step 3: Implement** — `lib/hapi-plugin/helpers/model-handler.js`, replace `notFoundModuleNotEqualsModel` with:

```js
const notFoundModuleNotEqualsModel = (err, fullModuleFileName) => {
    // only the first line names the missing module: Node >= 12 appends "\nRequire stack:\n- ..."
    const errMsg = err.message.split('\n')[0],
        notFoundFile = errMsg.substring(20, errMsg.length-1);
    return (path.resolve(cwd, notFoundFile)!==fullModuleFileName);
};
```

and in `getModelFn` replace

```js
        if (GLOBAL_MODELS[modelAffinity]!==undefined) {
            GLOBAL_MODELS[modelAffinity];
        }
```

with

```js
        if (GLOBAL_MODELS[modelAffinity]!==undefined) {
            // a model found before, or `false`: known not to exist
            return GLOBAL_MODELS[modelAffinity] || undefined;
        }
```

and replace the `catch` block of the `require` with:

```js
            catch (err) {
                if ((err.code!=='MODULE_NOT_FOUND') || (internalError=notFoundModuleNotEqualsModel(err, prefix+modelAffinity+'.js'))) {
                    console.error(err);
                }
                else {
                    // the model does not exist: don't look for it on every request
                    GLOBAL_MODELS[modelAffinity] = false;
                }
                resolve();
            }
```

- [ ] **Step 4: Run the file, then the suite** — `node --test --test-force-exit tests/model-handler.test.js` → PASS; `npm test` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/hapi-plugin/helpers/model-handler.js tests/model-handler.test.js
git commit -m "FIXED: missing @phone/@tablet models were logged as errors on every page (Node >= 12)

Since Node 12 the MODULE_NOT_FOUND message ends with a require stack, so the check that tells a
missing model from a model with a missing dependency always said 'internal error' and logged a full
stack, 1-3 times per page. It reads the first line now. A missing model is also remembered (the
cache check had no return), so it is looked up once instead of on every request.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: ESLint runs over all of lib/ and passes (18.x)

**Files:**
- Modify: `.eslintrc` (rule rename; `space-before-function-paren`; `no-console` allow list)
- Create: `.eslintignore`
- Modify: `package.json` (`scripts.lint`)
- Modify: files under `lib/` that have lint errors (formatting, unused variables, useless escapes, `/* eslint no-console: 0*/` headers)

**Interfaces:**
- Produces: `.eslintrc` and `.eslintignore` that Task 7 copies to 17.x unchanged; `npm run lint` = `eslint ./lib`.

- [ ] **Step 1: See it fail** — `npm run lint` → every file reports `Definition for rule 'react/wrap-multilines' was not found`.

- [ ] **Step 2: Fix the configuration**
  - `.eslintrc`: `"react/wrap-multilines": 2` → `"react/jsx-wrap-multilines": 2` (eslint-plugin-react 7 renamed it).
  - `.eslintrc`: the code writes named functions and methods as `name(args)` everywhere (0 places use `name (args)`), so set `space-before-function-paren` to `{"anonymous": "never", "named": "never", "asyncArrow": "always"}`.
  - `.eslintrc`: `console.debug` is this package's own debug channel (created by `lib/hapi-plugin/helpers/console-debug.js`), so `"no-console": [2, {allow: ["warn", "error", "debug"]}]`.
  - Create `.eslintignore` with the single line `lib/**/*.min.js` (generated, minified files).
  - `package.json`: `"lint": "eslint ./lib"`.

- [ ] **Step 3: List what is left** — `npm run lint`. Expected: roughly 50-60 errors (about 120 before Step 2, minus the 60 `space-before-function-paren` and the `console.debug` ones), in: `indent`, `semi`, `eol-last`, `spaced-comment`, `no-else-return`, `keyword-spacing`, `brace-style`, `space-before-blocks` (formatting), `no-console` (`console.log`), `no-useless-escape`, `no-unused-vars`, `no-undef`, `func-style`, `max-len`.

- [ ] **Step 4: Fix the code** — only these kinds of changes, none that changes behaviour:
  - Formatting rules: `npx eslint ./lib --fix`, then read the whole `git diff` and make sure it only changed whitespace, semicolons and braces placement.
  - `no-console` on `console.log`: files that log on purpose (build, watch and cdn scripts, startup messages such as `starting socketserver on`) get the header comment `/* eslint no-console: 0*/` next to their other `/* eslint ... */` comments, as `ddos-prevention.js` already has. Do not change the logging.
  - `no-useless-escape`: remove the backslash. Every hit is either inside a regex character class (`[^\/]` → `[^/]`) or inside a string literal, where `'\/'` already is `'/'` — the resulting string or regex is identical. In `lib/transfered-properties.js:16` this turns `\d` into `d`: that IS the current value of that string (a JS string drops the backslash), so behaviour stays the same. Add above that line: `// NOTE: this string always contained d{4}, not \d{4}: the regex never matches an ISO date, so dates reach the client as strings (kept as is)`.
  - `max-len` on `lib/transfered-properties.js:16` (the minified string): add `// eslint-disable-line max-len` at the end of that line.
  - `no-unused-vars`: remove an unused `require` (`path` in `lib/find-cdn.js` and `lib/find-url-load-limit.js`). For the unused `element` parameter in `lib/polyfills/request-animation-frame.js` keep the signature (it mirrors `window.requestAnimationFrame(callback, element)`) and add `// eslint-disable-line no-unused-vars`.
  - `no-undef` `autoparams` in `lib/serviceworker/serviceworker.js`: it is a placeholder that `generate-serviceworker.js` replaces with the real arguments; add `/* global autoparams */` at the top of the file.
  - `func-style` in `lib/webpack/main-page-plugin.js`: turn `function MainPagePlugin(...) {` into `const MainPagePlugin = function(...) {` (with the closing `};`) only if nothing uses it above its definition; otherwise add `// eslint-disable-line func-style`.
  - Anything not covered above: stop and report it instead of guessing.

- [ ] **Step 5: Check** — `npm run lint` → 0 problems. `npm test` → all PASS. `git diff --stat` shows only `.eslintrc`, `.eslintignore`, `package.json` and `lib/` files.

- [ ] **Step 6: Commit**

```bash
git add .eslintrc .eslintignore package.json lib
git commit -m "FIXED: ESLint - removed rule name, lint all of lib/, no errors

eslint-plugin-react 7 renamed react/wrap-multilines to react/jsx-wrap-multilines, so ESLint stopped
on every file. npm run lint now checks all of lib/ (minified files ignored). The config follows the
code's style for function parentheses and allows console.debug (the package's debug channel);
formatting, unused requires and useless escapes are fixed without changing behaviour.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Part B — 17.1.0 on branch `DEV-17.1.0-memory-leaks` (worktree `/Users/marco/Documents/Projects/itsa-react-server-17.1.0`)

In Part B, `$REPO` is `/Users/marco/Documents/Projects/itsa-react-server` (stays on `DEV-hapi21`; only read from it) and `$WT` is `/Users/marco/Documents/Projects/itsa-react-server-17.1.0`. Every command in Part B runs in `$WT` unless it says otherwise. hapi 16 uses the `reply` interface (`reply.continue()`, `reply(value)`). `master` has no fixture app, so the 17.x tests are unit tests in `tests/*.test.js`.

### Task 6: 17.x worktree, React 16, rebuilt package-lock.json, node:test

**Files:**
- Modify: `$WT/package.json` (`react`, `react-dom`, `scripts.test`), `$WT/package-lock.json` (rebuilt by npm)
- Modify: `$WT/lib/hapi-plugin/helpers/jsx-view.js:40-46`, `$WT/lib/default-manifest.json` (React UMD paths)
- Delete: `$WT/tests/itsa-hapi-react-server.js` (empty mocha placeholder; mocha and chai are not installed)
- Create: `$WT/tests/fixtures/views/_make.js`, `index.js`, `login.js` (copied from 18.x), `$WT/tests/fixtures/react15-render.json` (copied), `$WT/tests/parity/render-samples.js` (copied)
- Create: `$WT/tests/react-render.test.js`, `$WT/tests/default-manifest.test.js`

**Interfaces:**
- Produces: `npm test` = `node --test --test-force-exit "tests/*.test.js"` (plus `pretest` from Task 7); an installed `$WT/node_modules` with hapi 16.8.4 (peer dependency) and React 16.14. Later 17.x tasks add `tests/*.test.js` files.

- [ ] **Step 1: Create the branch and its folder** (use superpowers:using-git-worktrees; the location is fixed by Global Constraints):

```bash
git -C /Users/marco/Documents/Projects/itsa-react-server worktree add -b DEV-17.1.0-memory-leaks /Users/marco/Documents/Projects/itsa-react-server-17.1.0 master
```

- [ ] **Step 2: React 16 and the lockfile**
  - In `$WT/package.json`: `"react": "^16.14.0"`, `"react-dom": "^16.14.0"` (were `^15.5.4`); `"test": "node --test --test-force-exit \"tests/*.test.js\""` (keep `pretest` and `lint` as they are; Task 7 fixes them).
  - `cd "$WT" && npm install --no-audit --no-fund` — no `--legacy-peer-deps`/`--force`. This rebuilds `package-lock.json` (checked beforehand in a scratch copy: no ERESOLVE once React is 16).
  - Check: `npm ls react react-dom hapi socket.io` → react 16.14.0, react-dom 16.14.0, hapi 16.8.4, socket.io 2.2.0 (bumped in Task 9). `git -C "$WT" rm -q tests/itsa-hapi-react-server.js`.

- [ ] **Step 3: Copy the React 15 render snapshot from 18.x** (recorded through 17.x's jsx-view on React 15):

```bash
mkdir -p "$WT/tests/fixtures/views" "$WT/tests/parity"
for f in _make.js index.js login.js; do git -C "$REPO" show DEV-hapi21:tests/fixtures/app/build/view_components/$f > "$WT/tests/fixtures/views/$f"; done
git -C "$REPO" show DEV-hapi21:tests/fixtures/react15-render.json > "$WT/tests/fixtures/react15-render.json"
git -C "$REPO" show DEV-hapi21:tests/parity/render-samples.js > "$WT/tests/parity/render-samples.js"
```

- [ ] **Step 4: Write the failing tests** — `$WT/tests/react-render.test.js`:

```js
'use strict';

// 17.1.0 renders with React 16 (was 15). The markup must stay what React 15 gave (recorded through
// this jsx-view on React 15: tests/fixtures/react15-render.json), and the deprecated
// React.createFactory must not be used (React 16 warns about it).

const {test} = require('node:test'),
    assert = require('node:assert'),
    path = require('path'),
    SAMPLES = require('./parity/render-samples'),
    recorded = require('./fixtures/react15-render.json'),
    View = require('../lib/hapi-plugin/helpers/jsx-view').View,
    VIEWS = path.join(__dirname, 'fixtures', 'views');

// first: React warns only once per process
test('rendering uses no deprecated React API', () => {
    const originalWarn = console.warn,
        originalError = console.error,
        messages = [];
    console.warn = (...args) => messages.push(args.join(' '));
    console.error = (...args) => messages.push(args.join(' '));
    try {
        View.compile('', {})(SAMPLES.index.props, {filename: path.join(VIEWS, 'index.js')});
    }
    finally {
        console.warn = originalWarn;
        console.error = originalError;
    }
    assert.deepStrictEqual(messages.filter(message => /deprecated/i.test(message)), []);
});

Object.keys(SAMPLES).forEach(name => {
    test('jsx-view renders "'+name+'" exactly as React 15 did', () => {
        const filename = path.join(VIEWS, SAMPLES[name].view+'.js');
        assert.strictEqual(View.compile('', {})(SAMPLES[name].props, {filename}), recorded[name]);
    });
});
```

and `$WT/tests/default-manifest.test.js`:

```js
'use strict';

// The external modules in the default manifest point at files inside node_modules; React 16 has no
// dist/ folder any more (its UMD builds are in umd/), so every path must exist with React 16.

const {test} = require('node:test'),
    assert = require('node:assert'),
    fs = require('fs'),
    path = require('path'),
    ROOT = path.resolve(__dirname, '..'),
    manifest = require('../lib/default-manifest.json');

const externalFiles = (value, found) => {
    if (Array.isArray(value)) {
        value.forEach(item => externalFiles(item, found));
    }
    else if (value && (typeof value==='object')) {
        if (value.module && value.file) {
            found.push(value.file);
        }
        Object.keys(value).forEach(key => externalFiles(value[key], found));
    }
    return found;
};

test('every external-module file of the default manifest exists', () => {
    const files = externalFiles(manifest, []);
    assert.ok(files.length>0);
    assert.deepStrictEqual(files.filter(file => !fs.existsSync(path.join(ROOT, 'node_modules', file))), []);
});
```

- [ ] **Step 5: Run and see them fail** — `cd "$WT" && node --test --test-force-exit "tests/*.test.js"`
Expected FAIL: `rendering uses no deprecated React API` (`React.createFactory() is deprecated`), and the manifest test listing the `react/dist/...` and `react-dom/dist/...` files. The two React 15 render comparisons PASS (React 16 renders the same markup).

- [ ] **Step 6: Implement** — take exactly 18.x's React 16 change of these two files (commit 922f70d; both files on `master` equal their state just before it):

```bash
git -C "$REPO" show 922f70d -- lib/hapi-plugin/helpers/jsx-view.js lib/default-manifest.json | git -C "$WT" apply
```

Result in `jsx-view.js`: `VIEW_CACHE[view] = global.__viewComponent;` and `output += ReactDOMServer[method](React.createElement(VIEW_CACHE[view], context));`; in `default-manifest.json` the `react/dist/...`, `react-dom/dist/...` paths become `react/umd/react.production.min.js`, `react-dom/umd/react-dom.production.min.js`, `react-dom/umd/react-dom-server.browser.production.min.js` (and the `.development.js` ones for `local` and `development`).

- [ ] **Step 7: Run and see them pass** — `cd "$WT" && node --test --test-force-exit "tests/*.test.js"` → all PASS.

- [ ] **Step 8: Commit** (in `$WT`)

```bash
git add package.json package-lock.json lib/hapi-plugin/helpers/jsx-view.js lib/default-manifest.json tests
git commit -m "CHANGED: React 16; package-lock.json rebuilt; tests on node:test

npm could not build the lockfile without --legacy-peer-deps: React 15 at the root against
itsa-react-globalstate's peer react >=16 (every published version needs it). React goes one major
step to 16 (as 18.x did): jsx-view renders with React.createElement instead of the deprecated
React.createFactory, and the default manifest points at React 16's umd/ files. The markup equals the
React 15 snapshot. npm test runs node:test (the empty mocha placeholder is gone; mocha and chai were
never installed).

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: ESLint runs over all of lib/ and passes (17.x)

**Files:**
- Modify: `$WT/.eslintrc` (replaced by 18.x's), Create: `$WT/.eslintignore` (18.x's)
- Modify: `$WT/package.json` (`scripts.lint`, `scripts.pretest`)
- Modify: files under `$WT/lib/` that have lint errors

**Interfaces:**
- Consumes: `.eslintrc` and `.eslintignore` from Task 5 (commit on `DEV-hapi21`).
- Produces: `npm run lint` = `eslint ./lib`, run again by `pretest` before every `npm test`.

- [ ] **Step 1: See it fail** — `cd "$WT" && npx eslint ./lib/*.js` → `Definition for rule 'react/wrap-multilines' was not found`.

- [ ] **Step 2: Take 18.x's configuration** (`.eslintrc` is identical on `master` and `DEV-hapi21` before Task 5):

```bash
git -C "$REPO" show DEV-hapi21:.eslintrc > "$WT/.eslintrc"
git -C "$REPO" show DEV-hapi21:.eslintignore > "$WT/.eslintignore"
```

  In `$WT/package.json`: `"lint": "eslint ./lib"` and `"pretest": "eslint ./lib"`.

- [ ] **Step 3: List what is left** — `cd "$WT" && npm run lint`.

- [ ] **Step 4: Fix the code** — the same kinds of changes as Task 5, none that changes behaviour:
  - Formatting rules: `npx eslint ./lib --fix`, then read the whole `git diff` and make sure it only changed whitespace, semicolons and braces placement.
  - `no-console` on `console.log`: files that log on purpose (build, watch and cdn scripts, startup messages) get the header comment `/* eslint no-console: 0*/` next to their other `/* eslint ... */` comments. Do not change the logging.
  - `no-useless-escape`: remove the backslash (inside a regex character class, or inside a string literal where `'\/'` already is `'/'`: the resulting string or regex is identical). In `lib/transfered-properties.js` the long minified string turns `\d` into `d`, which IS its current value; add above that line: `// NOTE: this string always contained d{4}, not \d{4}: the regex never matches an ISO date, so dates reach the client as strings (kept as is)`, and `// eslint-disable-line max-len` at the end of the long line.
  - `no-unused-vars`: remove unused `require`s. For the unused `element` parameter in `lib/polyfills/request-animation-frame.js` keep the signature and add `// eslint-disable-line no-unused-vars`.
  - `no-undef` `autoparams` in `lib/serviceworker/serviceworker.js`: add `/* global autoparams */` at the top of the file.
  - `func-style` in `lib/webpack/main-page-plugin.js`: `function MainPagePlugin(...) {` → `const MainPagePlugin = function(...) {` (closing `};`) only if nothing uses it above its definition; otherwise `// eslint-disable-line func-style`.
  - Anything not covered above (17.x has hapi 16 code that 18.x has not, e.g. `extend-reply.js`): stop and report it instead of guessing.

- [ ] **Step 5: Check** — `cd "$WT" && npm run lint` → 0 problems; `npm test` (runs `pretest` lint first) → all PASS.

- [ ] **Step 6: Commit** (in `$WT`)

```bash
git add .eslintrc .eslintignore package.json lib
git commit -m "FIXED: ESLint - removed rule name, lint all of lib/, no errors

eslint-plugin-react 7 renamed react/wrap-multilines to react/jsx-wrap-multilines, so ESLint stopped
on every file (and with it npm test's pretest). The configuration is the one of 18.x: all of lib/
(minified files ignored), function parentheses as the code writes them, console.debug allowed.
Formatting, unused requires and useless escapes are fixed without changing behaviour.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 17.x find-package-version reads package.json without require

**Files:**
- Modify: `$WT/lib/find-package-version.js` (whole file below)
- Create: `$WT/tests/find-package-version.test.js`

**Interfaces:**
- Produces: `getVersion(module?: string): string`, unchanged signature and results.

- [ ] **Step 1: Write the failing test** — `$WT/tests/find-package-version.test.js`:

```js
'use strict';

// getVersion() runs on every page render (assets-handler, build-props): it must read package.json
// without keeping anything. With require-reload every call left one Module in module.children.

const {test, before, after} = require('node:test'),
    assert = require('node:assert'),
    fs = require('fs'),
    os = require('os'),
    path = require('path'),
    START_DIR = process.cwd(),
    APP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'itsa-fpv-')));

let findPackageVersion, fpvModule;

const writePackage = (dir, content) => {
    fs.mkdirSync(path.join(APP, dir), {recursive: true});
    fs.writeFileSync(path.join(APP, dir, 'package.json'), content);
};

before(() => {
    writePackage('', JSON.stringify({name: 'app', version: '3.2.1'}));
    writePackage('node_modules/some-package', JSON.stringify({name: 'some-package', version: '1.2.3'}));
    writePackage('node_modules/bom-package', '\uFEFF'+JSON.stringify({name: 'bom-package', version: '7.0.0'}));
    writePackage('externals/external-package', JSON.stringify({name: 'external-package', version: '4.5.6'}));
    // find-package-version reads process.cwd() when it loads
    process.chdir(APP);
    findPackageVersion = require('../lib/find-package-version');
    fpvModule = require.cache[require.resolve('../../lib/find-package-version')];
});

after(() => {
    process.chdir(START_DIR);
    fs.rmSync(APP, {recursive: true, force: true});
});

test('reads the version of an installed package, also for a file inside it', () => {
    assert.strictEqual(findPackageVersion.getVersion('some-package'), '1.2.3');
    assert.strictEqual(findPackageVersion.getVersion('some-package/dist/some.js'), '1.2.3');
});

test('reads a package.json that starts with a byte order mark', () => {
    assert.strictEqual(findPackageVersion.getVersion('bom-package'), '7.0.0');
});

test('falls back to externals/', () => {
    assert.strictEqual(findPackageVersion.getVersion('external-package'), '4.5.6');
});

test('without a module it reads the app itself', () => {
    assert.strictEqual(findPackageVersion.getVersion(), '3.2.1');
});

test('a missing package gives 0.0.1 and a warning', () => {
    const originalWarn = console.warn,
        warnings = [];
    console.warn = (...args) => warnings.push(args);
    try {
        assert.strictEqual(findPackageVersion.getVersion('missing-package'), '0.0.1');
    }
    finally {
        console.warn = originalWarn;
    }
    assert.deepStrictEqual(warnings, [['Package', 'missing-package', 'seems not to be installed']]);
});

test('a changed package.json is read again', () => {
    writePackage('node_modules/changing-package', JSON.stringify({version: '1.0.0'}));
    assert.strictEqual(findPackageVersion.getVersion('changing-package'), '1.0.0');
    writePackage('node_modules/changing-package', JSON.stringify({version: '1.0.1'}));
    assert.strictEqual(findPackageVersion.getVersion('changing-package'), '1.0.1');
});

test('repeated lookups keep no modules', () => {
    const childrenBefore = fpvModule.children.length;
    for (let i = 0; i<1000; i++) {
        findPackageVersion.getVersion('some-package');
    }
    assert.strictEqual(fpvModule.children.length, childrenBefore);
    assert.deepStrictEqual(Object.keys(require.cache).filter(file => file.startsWith(APP)), []);
});
```

- [ ] **Step 2: Run and see it fail**

Run: `cd "$WT" && node --test --test-force-exit tests/find-package-version.test.js`
Expected: `repeated lookups keep no modules` FAILS (children grew by 1000); the others pass.

- [ ] **Step 3: Implement** — replace everything below the license header of `$WT/lib/find-package-version.js` (keep the header comment and `/* eslint no-empty: 0*/`) with:

```js
// package.json is read with fs, not with require(): getVersion() runs on every page render, and
// require-reload left a new Module in this module's `children` on every call (a memory leak)
const fs = require('fs'),
    cwd = process.cwd(),
    path = require('path'),
    BOM = /^\uFEFF/;

// the parsed package.json, or undefined when the file is missing or unreadable
const readPackage = file => {
    let packageInfo;
    try {
        packageInfo = JSON.parse(fs.readFileSync(file, 'utf8').replace(BOM, ''));
    }
    catch (err) {}
    return packageInfo;
};

const getVersion = module => {
    let nodedir, externalsdir, packageInfo, indexSlash;
    if (!module) {
        // take main app
        module = '';
        nodedir = '';
    }
    else {
        indexSlash = module.indexOf('/');
        if (indexSlash!==-1) {
            module = module.substr(0, indexSlash);
        }
        nodedir = 'node_modules';
        externalsdir = 'externals';
    }
    packageInfo = readPackage(path.resolve(cwd, nodedir, module, 'package.json'));
    if (!packageInfo && externalsdir) {
        // file not found -> try `externals`
        packageInfo = readPackage(path.resolve(cwd, externalsdir, module, 'package.json'));
    }
    if (!packageInfo) {
        console.warn('Package', module, 'seems not to be installed');
        packageInfo = {
            version: '0.0.1'
        };
    }
    return packageInfo.version;
};

module.exports = {
    getVersion
};
```

- [ ] **Step 4: Run and see it pass** — `cd "$WT" && npm test` → lint 0 problems, all tests PASS.

- [ ] **Step 5: Commit** (in `$WT`)

```bash
git add lib/find-package-version.js tests/find-package-version.test.js
git commit -m "FIXED: memory leak on every page render (find-package-version)

getVersion() re-required <cwd>/node_modules/<package>/package.json through require-reload on every
full page (preboot, babel-polyfill) and every page and props request with the socket server on
(socket.io-client). Every call left a new Module in module.children: 2-6 KB per page, until the
worker died with 'out of memory'. package.json is now read with fs.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: 17.x socket server — socket.io 2.5.1, no compression, bad messages ignored

**Files:**
- Modify: `$WT/package.json`, `$WT/package-lock.json` (via npm)
- Modify: `$WT/lib/socketio/socketserver.js` (constants, `SocketIO(...)`, `clientconnected` handler)
- Modify: `$WT/lib/hapi-plugin/plugin.js` (`startSocketServer`, the `SocketServer.start({...})` call)
- Create: `$WT/tests/socketserver-transport.test.js`, `$WT/tests/socketserver-bad-packet.test.js`, `$WT/tests/socketserver-config.test.js`

**Interfaces:**
- Consumes: `SocketServer.start(config)`, `getSocketServer()` (`.socketIO.eio.maxHttpBufferSize`, `.socketConnections`); master's socketserver uses `new Hapi.Server()` + `server.connection({host, port})` with `require('hapi')` (hapi 16).
- Produces: `config.maxHttpBufferSize` on `SocketServer.start`; manifest key `socketServer.maxHttpBufferSize`.

- [ ] **Step 1: Write the failing transport test** — `$WT/tests/socketserver-transport.test.js`:

```js
'use strict';

// Transport settings of the socket server (socket.io 2.5 / engine.io 3.6 / ws 7): websocket messages
// are not compressed (permessage-deflate leaked memory), large client messages are still accepted,
// and socket.io-client 2.x still connects.

const {test, before, after} = require('node:test'),
    assert = require('node:assert'),
    http = require('http'),
    path = require('path'),
    ioClient = require('socket.io-client'),
    SocketServer = require('../lib/socketio/socketserver'),
    PORT = 4801,
    STARTUP = 1234567890;

const clients = [];

const connect = () => {
    const client = ioClient('http://127.0.0.1:'+PORT, {transports: ['websocket'], forceNew: true, reconnection: false});
    clients.push(client);
    return client;
};

// resolves with the event's first argument, rejects after `ms`
const waitFor = (emitter, event, ms) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no '+event+' within '+ms+' ms')), ms);
    emitter.once(event, value => {
        clearTimeout(timer);
        resolve(value);
    });
});

const listening = async () => {
    let lastError;
    for (let attempt = 0; attempt<30; attempt++) {
        try {
            return await fetch('http://127.0.0.1:'+PORT+'/socket.io/?EIO=3&transport=polling');
        }
        catch (err) {
            lastError = err;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    throw lastError;
};

before(async () => {
    SocketServer.start({host: '127.0.0.1', port: PORT, serverStartupTime: STARTUP});
    await listening();
});

after(() => {
    clients.forEach(client => client.close());
});

test('a websocket upgrade does not negotiate permessage-deflate', async () => {
    const res = await new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1',
            port: PORT,
            path: '/socket.io/?EIO=3&transport=websocket',
            headers: {
                Connection: 'Upgrade',
                Upgrade: 'websocket',
                'Sec-WebSocket-Version': '13',
                'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
                'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits'
            }
        });
        req.on('upgrade', (response, socket) => {
            socket.destroy();
            resolve(response);
        });
        req.on('response', response => reject(new Error('no upgrade, status '+response.statusCode)));
        req.on('error', reject);
        req.end();
    });
    assert.strictEqual(res.statusCode, 101);
    assert.strictEqual(res.headers['sec-websocket-extensions'], undefined);
});

test('socket.io uses a ws without the stalled-compression bug (ws >= 7.1.2)', () => {
    const socketIoDir = path.dirname(require.resolve('socket.io/package.json')),
        engineIoDir = path.dirname(require.resolve('engine.io/package.json', {paths: [socketIoDir]})),
        version = require(require.resolve('ws/package.json', {paths: [engineIoDir]})).version,
        parts = version.split('.').map(Number);
    assert.ok((parts[0]>7) || ((parts[0]===7) && ((parts[1]>1) || ((parts[1]===1) && (parts[2]>=2)))), 'engine.io uses ws '+version);
});

test('without a manifest value a client message may be up to 100 MB', () => {
    assert.strictEqual(SocketServer.getSocketServer().socketIO.eio.maxHttpBufferSize, 1e8);
});

test('socket.io-client connects and hears that the server restarted', async () => {
    const client = connect();
    await waitFor(client, 'connect', 5000);
    client.emit('clientconnected', {props: {__appProps: {serverStartup: STARTUP-1}}});
    await waitFor(client, 'versionchanged', 5000);
});

test('a clientconnected message larger than 1 MB is accepted', async () => {
    const client = connect();
    await waitFor(client, 'connect', 5000);
    client.emit('clientconnected', {props: {__appProps: {serverStartup: STARTUP-1}, model: 'x'.repeat(2*1024*1024)}});
    await waitFor(client, 'versionchanged', 5000);
});
```

- [ ] **Step 2: Write the failing bad-packet test** — `$WT/tests/socketserver-bad-packet.test.js`:

```js
'use strict';

// A clientconnected message without props threw inside socket.io's event dispatch
// (data.props.__appProps): an uncaught exception that ended the whole worker.

const {test, before, after} = require('node:test'),
    assert = require('node:assert'),
    ioClient = require('socket.io-client'),
    SocketServer = require('../lib/socketio/socketserver'),
    PORT = 4802,
    STARTUP = 1234567890;

const clients = [];

const connect = () => {
    const client = ioClient('http://127.0.0.1:'+PORT, {transports: ['websocket'], forceNew: true, reconnection: false});
    clients.push(client);
    return client;
};

// resolves with the event's first argument, rejects after `ms`
const waitFor = (emitter, event, ms) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no '+event+' within '+ms+' ms')), ms);
    emitter.once(event, value => {
        clearTimeout(timer);
        resolve(value);
    });
});

const listening = async () => {
    let lastError;
    for (let attempt = 0; attempt<30; attempt++) {
        try {
            return await fetch('http://127.0.0.1:'+PORT+'/socket.io/?EIO=3&transport=polling');
        }
        catch (err) {
            lastError = err;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    throw lastError;
};

before(async () => {
    SocketServer.start({host: '127.0.0.1', port: PORT, serverStartupTime: STARTUP});
    await listening();
});

after(() => {
    clients.forEach(client => client.close());
});

test('malformed clientconnected messages are ignored and the server keeps working', async () => {
    const client = connect();
    await waitFor(client, 'connect', 5000);
    [null, 'text', 42, [], {}, {props: null}, {props: 'text'}, {props: {}}, {props: {__appProps: null}}].forEach(data => {
        client.emit('clientconnected', data);
    });
    // handled in order: this answer means every message above was handled without a crash
    client.emit('clientconnected', {props: {__appProps: {serverStartup: STARTUP-1}}});
    await waitFor(client, 'versionchanged', 5000);
    assert.strictEqual(SocketServer.getSocketServer().socketConnections.size, 1);
});
```

- [ ] **Step 3: Write the failing config test** — `$WT/tests/socketserver-config.test.js`:

```js
'use strict';

// socketServer.maxHttpBufferSize in the manifest reaches engine.io (plugin.js passes it to start()).

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    SocketServer = require('../lib/socketio/socketserver'),
    PORT = 4803;

before(() => {
    SocketServer.start({host: '127.0.0.1', port: PORT, serverStartupTime: 1, maxHttpBufferSize: 5000000});
});

test('the configured largest client message is used', () => {
    assert.strictEqual(SocketServer.getSocketServer().socketIO.eio.maxHttpBufferSize, 5000000);
});
```

- [ ] **Step 4: Run and see them fail** — `cd "$WT" && npm test`
Expected FAIL: permessage-deflate negotiated, ws 6.1.4, the bad-packet test (uncaught TypeError), the config test (1e8). Passing: 100 MB default, client round trip, 2 MB message.

- [ ] **Step 5: Upgrade socket.io** — `cd "$WT" && npm install 'socket.io@^2.5.1' --no-audit --no-fund` (no `--legacy-peer-deps`/`--force`; on ERESOLVE stop and report). Check: `npm ls socket.io engine.io socket.io-client` shows 2.5.1, 3.6.x, 2.5.0; `package.json` has `"socket.io": "^2.5.1"`.

- [ ] **Step 6: Implement** — `$WT/lib/socketio/socketserver.js`, replace

```js
    later = require('itsa-utils').later,
    SEQUENTIAL_CLIENT_UPDATE_DELAY = 2000; // not too often: give the clients time to refresh and queue any server-changes
```

with

```js
    later = require('itsa-utils').later,
    SEQUENTIAL_CLIENT_UPDATE_DELAY = 2000, // not too often: give the clients time to refresh and queue any server-changes
    // largest message a client may send, in bytes: `clientconnected` carries the page's props, so keep
    // the 100 MB of engine.io 3.3 instead of the 1 MB default of engine.io 3.6
    DEF_MAX_HTTP_BUFFER_SIZE = 1e8;
```

replace `instance.socketIO = SocketIO(server.listener);` with

```js
        instance.socketIO = SocketIO(server.listener, {
            // no websocket compression: every connection kept its own zlib context (about 300 KB),
            // and with ws < 7.1.2 a client that disconnected during a compression stalled all later
            // ones, which then stayed in memory for good
            perMessageDeflate: false,
            maxHttpBufferSize: config.maxHttpBufferSize || DEF_MAX_HTTP_BUFFER_SIZE
        });
```

replace the `clientconnected` handler in `setupConnectionListeners` with

```js
            socket.on('clientconnected', data => {
                // a client sends its props: ignore anything else, a bad message must not crash the process
                const appProps = data && data.props && data.props.__appProps;
                if (!appProps) {
                    return;
                }
                instance.socketConnections.set(socket, data);
                // if the client has a different version, then send a signal to refresh the page
                if (appProps.serverStartup!==instance._serverStartupTime) {
                    // inform the client to relaod the page
                    socket.emit('versionchanged');
                }
            });
```

and in `$WT/lib/hapi-plugin/plugin.js` `startSocketServer` make the call:

```js
        SocketServer.start({
            host,
            port,
            serverStartupTime: server.root._startupTime,
            sequentialClientUpdate: appConfig.sequentialClientUpdate,
            maxHttpBufferSize: appConfig.socketServer.maxHttpBufferSize
        });
```

- [ ] **Step 7: Run and see them pass** — `cd "$WT" && npm test` → lint 0 problems, all PASS.

- [ ] **Step 8: Commit** (in `$WT`)

```bash
git add package.json package-lock.json lib/socketio/socketserver.js lib/hapi-plugin/plugin.js tests/socketserver-transport.test.js tests/socketserver-bad-packet.test.js tests/socketserver-config.test.js
git commit -m "FIXED: socket server memory leak and crash on a malformed message

socket.io 2.2.0 ran ws 6.1.4 with permessage-deflate on. A client that disconnected during a
compression never freed its slot in ws's zlib limiter; after 10 of them every later message and its
socket stayed in memory for good. Compression is off now and socket.io is ^2.5.1 (ws 7.5).
maxHttpBufferSize stays 1e8 (engine.io 3.6 defaults to 1e6); the manifest can set
socketServer.maxHttpBufferSize. A clientconnected message without props threw an uncaught
TypeError; it is ignored now.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```


---

### Task 10: 17.x missing affinity models are not logged as errors, and are looked up once

**Files:**
- Modify: `$WT/lib/hapi-plugin/helpers/model-handler.js` (`notFoundModuleNotEqualsModel`, cache check and `catch` in `getModelFn`)
- Create: `$WT/tests/model-handler.test.js`

**Interfaces:**
- Consumes: `merge(request, reply, props, routeOptions, appConfig, view)` from `lib/hapi-plugin/helpers/model-handler.js`.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test** — `$WT/tests/model-handler.test.js`:

```js
'use strict';

// Models are looked up per affinity: <view>@phone, <view>@tablet, <view>. A missing level is normal
// and must not be logged (on Node >= 12 it was: the MODULE_NOT_FOUND message got a "Require stack"),
// and is looked up only once. A model that fails to load must still be reported every time.

const {test, before, after, beforeEach} = require('node:test'),
    assert = require('node:assert'),
    fs = require('fs'),
    os = require('os'),
    path = require('path'),
    Module = require('module'),
    START_DIR = process.cwd(),
    APP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'itsa-models-'))),
    originalError = console.error,
    originalDebug = console.debug,
    originalLoad = Module._load;

let modelHandler, errors, loads;

const writeModel = (name, code) => {
    fs.writeFileSync(path.join(APP, 'src', 'models', name+'.js'), code);
};

const merge = async (view, device) => {
    const props = {__appProps: {device, lang: 'en'}};
    await modelHandler.merge({query: {}, params: {}, payload: null}, {}, props, {}, {debug: false}, view);
    return props;
};

before(() => {
    fs.mkdirSync(path.join(APP, 'src', 'models'), {recursive: true});
    writeModel('desktop-only', 'module.exports = () => ({fromModel: \'desktop-only\'});\n');
    writeModel('broken', 'require(\'itsa-no-such-module\');\nmodule.exports = () => ({});\n');
    writeModel('syntax-error', 'module.exports = (;\n');
    // model-handler reads process.cwd() when it loads
    process.chdir(APP);
    modelHandler = require('../lib/hapi-plugin/helpers/model-handler');
    console.error = (...args) => errors.push(args);
    console.debug = () => {};
    Module._load = function(request) {
        if (request.indexOf('/src/models/')!==-1) {
            loads.push(request);
        }
        return originalLoad.apply(this, arguments);
    };
});

beforeEach(() => {
    errors = [];
    loads = [];
});

after(() => {
    console.error = originalError;
    console.debug = originalDebug;
    Module._load = originalLoad;
    process.chdir(START_DIR);
    fs.rmSync(APP, {recursive: true, force: true});
});

test('a phone page with only a desktop model uses it and logs nothing', async () => {
    const props = await merge('desktop-only', 'phone');
    assert.strictEqual(props.fromModel, 'desktop-only');
    assert.deepStrictEqual(errors, []);
});

test('a view without any model logs nothing', async () => {
    await merge('no-model', 'tablet');
    assert.deepStrictEqual(errors, []);
});

test('a model that does not exist is looked up only once', async () => {
    let firstLoads;
    await merge('never-there', 'phone');
    firstLoads = loads.length;
    await merge('never-there', 'phone');
    await merge('never-there', 'phone');
    assert.strictEqual(firstLoads, 3);
    assert.strictEqual(loads.length, firstLoads);
});

test('a model that fails to load is reported on every request', async () => {
    await merge('broken', 'phone');
    await merge('broken', 'phone');
    await merge('syntax-error', 'phone');
    assert.strictEqual(errors.length, 3);
    assert.match(errors[0][0].message, /itsa-no-such-module/);
    assert.match(errors[1][0].message, /itsa-no-such-module/);
    assert.ok(errors[2][0] instanceof SyntaxError);
});
```

- [ ] **Step 2: Run and see it fail** — `cd "$WT" && node --test --test-force-exit tests/model-handler.test.js` → all four FAIL (missing levels are logged and looked up every time).

- [ ] **Step 3: Implement** — in `$WT/lib/hapi-plugin/helpers/model-handler.js` replace `notFoundModuleNotEqualsModel` with:

```js
const notFoundModuleNotEqualsModel = (err, fullModuleFileName) => {
    // only the first line names the missing module: Node >= 12 appends "\nRequire stack:\n- ..."
    const errMsg = err.message.split('\n')[0],
        notFoundFile = errMsg.substring(20, errMsg.length-1);
    return (path.resolve(cwd, notFoundFile)!==fullModuleFileName);
};
```

replace

```js
        if (GLOBAL_MODELS[modelAffinity]!==undefined) {
            GLOBAL_MODELS[modelAffinity];
        }
```

with

```js
        if (GLOBAL_MODELS[modelAffinity]!==undefined) {
            // a model found before, or `false`: known not to exist
            return GLOBAL_MODELS[modelAffinity] || undefined;
        }
```

and replace the `catch` block of the `require` with:

```js
            catch (err) {
                if ((err.code!=='MODULE_NOT_FOUND') || (internalError=notFoundModuleNotEqualsModel(err, prefix+modelAffinity+'.js'))) {
                    console.error(err);
                }
                else {
                    // the model does not exist: don't look for it on every request
                    GLOBAL_MODELS[modelAffinity] = false;
                }
                resolve();
            }
```

- [ ] **Step 4: Run** — `cd "$WT" && npm test` → lint 0 problems, all PASS.

- [ ] **Step 5: Commit** (in `$WT`)

```bash
git add lib/hapi-plugin/helpers/model-handler.js tests/model-handler.test.js
git commit -m "FIXED: missing @phone/@tablet models were logged as errors on every page (Node >= 12)

Since Node 12 the MODULE_NOT_FOUND message ends with a require stack, so the check that tells a
missing model from a model with a missing dependency always said 'internal error' and logged a full
stack, 1-3 times per page. It reads the first line now. A missing model is also remembered (the
cache check had no return), so it is looked up once instead of on every request.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: 17.x hapi 16 answers requests with a payload on Node >= 16; version 17.1.0

> **Note (after execution):** the `request-close-fix.js` snippet in this task proved insufficient:
> moving only request.js's `_onClose` left transmit.js's own `onClose` on the request's 'close', which
> still truncated the response once the body had been read. The design as built is described in the
> spec's §6 (`docs/superpowers/specs/2026-09-25-memory-leak-restarts-design.md`, "17.x POST hang").
> The task body below is kept as it was planned.

**Files:**
- Create: `$WT/lib/hapi-plugin/helpers/request-close-fix.js`
- Modify: `$WT/lib/hapi-plugin/helpers/middleware.js` (require + call at the start of `generate`)
- Create: `$WT/tests/request-close-fix.test.js`
- Modify: `$WT/package.json` (`version` 17.1.0), `$WT/package-lock.json` (version fields, via npm), `$WT/README.md`

**Interfaces:**
- Consumes: hapi 16 `Request` internals: `request._onClose` (function, set in `_listenRequest`, attached with `request.raw.req.once('close', ...)`), `request.raw.req`, `request.raw.res`; hapi 16 `server.ext('onRequest', (request, reply) => reply.continue())`.
- Produces: `apply(server)` in `lib/hapi-plugin/helpers/request-close-fix.js`.

- [ ] **Step 1: Write the failing test** — `$WT/tests/request-close-fix.test.js`:

```js
'use strict';

// hapi 16 on Node >= 16 left every request with a payload unanswered: since Node 16 the request's
// 'close' event also fires once the body has been read, and hapi 16 takes it for a client disconnect
// (https://github.com/hapijs/hapi/issues/4298). Only real HTTP shows it; server.inject does not.

const {test, before, after} = require('node:test'),
    assert = require('node:assert'),
    http = require('http'),
    Hapi = require('hapi'),
    requestCloseFix = require('../lib/hapi-plugin/helpers/request-close-fix');

let server, port,
    closedRequests = 0;

const call = (method, body, agent) => new Promise((resolve, reject) => {
    const headers = (body===undefined) ? {} : {'content-type': 'application/json', 'content-length': Buffer.byteLength(body)},
        req = http.request({host: '127.0.0.1', port, path: '/echo', method, headers, agent, timeout: 3000}, res => {
            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });
            res.on('end', () => resolve({statusCode: res.statusCode, body: data}));
        });
    req.on('timeout', () => {
        req.destroy();
        reject(new Error(method+' got no response'));
    });
    req.on('error', reject);
    req.end(body);
});

before(() => new Promise((resolve, reject) => {
    server = new Hapi.Server();
    server.connection({host: '127.0.0.1', port: 0});
    requestCloseFix.apply(server);
    server.route({method: '*', path: '/echo', handler: (request, reply) => reply({method: request.method, payload: request.payload})});
    server.route({method: 'POST', path: '/slow', handler: (request, reply) => {
        setTimeout(() => reply('late'), 300);
    }});
    server.on('request-internal', (request, event, tags) => {
        if (tags.closed) {
            closedRequests++;
        }
    });
    server.start(err => {
        if (err) {
            return reject(err);
        }
        port = server.info.port;
        resolve();
    });
}));

after(() => new Promise(resolve => server.stop(resolve)));

test('a POST with a body is answered', async () => {
    const res = await call('POST', JSON.stringify({a: 1}));
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(res.body), {method: 'post', payload: {a: 1}});
});

test('an empty POST is answered', async () => {
    const res = await call('POST', '');
    assert.strictEqual(res.statusCode, 200);
});

test('a GET is still answered', async () => {
    const res = await call('GET');
    assert.strictEqual(res.statusCode, 200);
});

test('several POSTs over one keep-alive connection are all answered', async () => {
    const agent = new http.Agent({keepAlive: true, maxSockets: 1});
    try {
        for (let i = 0; i<3; i++) {
            assert.strictEqual((await call('POST', JSON.stringify({i}), agent)).statusCode, 200);
        }
    }
    finally {
        agent.destroy();
    }
});

test('a client that disconnects before the response is still detected', async () => {
    const closedBefore = closedRequests;
    await new Promise(resolve => {
        const req = http.request({host: '127.0.0.1', port, path: '/slow', method: 'POST', headers: {'content-type': 'application/json', 'content-length': 2}});
        req.on('error', () => {});
        req.end('{}');
        setTimeout(() => {
            req.destroy();
            resolve();
        }, 100);
    });
    await new Promise(resolve => setTimeout(resolve, 400));
    assert.strictEqual(closedRequests, closedBefore+1);
});
```

- [ ] **Step 2: Create a stub so the test can load, then see it fail** — create `$WT/lib/hapi-plugin/helpers/request-close-fix.js` with only `module.exports = {apply() {}};`, then run `cd "$WT" && node --test --test-force-exit tests/request-close-fix.test.js`.
Expected FAIL: `a POST with a body is answered`, `an empty POST is answered` and the keep-alive test (`POST got no response`). `a GET is still answered` and the disconnect test pass.

- [ ] **Step 3: Implement** — `$WT/lib/hapi-plugin/helpers/request-close-fix.js`:

```js
/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 17.1.0
*/

'use strict';

// hapi 16 takes the request's 'close' event for a client disconnect. Since Node 16 that event also
// fires once the request body has been read, so hapi 16 dropped every request with a payload (POST,
// PUT, ...) without answering it. On those Node versions a disconnect is detected from the response
// instead, the way hapi >= 20.2.1 does it: a 'close' before the response has ended.
// see https://github.com/hapijs/hapi/issues/4298

const NODE_MAJOR = parseInt(process.versions.node.split('.')[0], 10);

const apply = server => {
    if (NODE_MAJOR<16) {
        return;
    }
    server.ext('onRequest', (request, reply) => {
        const raw = request.raw;
        if (typeof request._onClose==='function') {
            raw.req.removeListener('close', request._onClose);
            raw.res.once('close', () => {
                if (!raw.res.writableEnded) {
                    request._onClose();
                }
            });
        }
        return reply.continue();
    });
};

module.exports = {
    apply
};
```

In `$WT/lib/hapi-plugin/helpers/middleware.js` add `requestCloseFix = require('./request-close-fix')` to the top `const` list (after `Ddos = require('./ddos-prevention')`, turning its `;` into `,`), and in `generate`, right after the `var serverConnection = server.root, ...;` declaration and before `ddos = new Ddos(...)`, add:

```js
    // hapi 16 on Node >= 16: answer requests that have a payload (see request-close-fix.js)
    requestCloseFix.apply(serverConnection);
```

- [ ] **Step 4: Run** — `cd "$WT" && npm test` → lint 0 problems, all PASS.

- [ ] **Step 5: Version and README**
  - `cd "$WT" && npm version 17.1.0 --no-git-tag-version` (updates `package.json` and `package-lock.json`).
  - In `$WT/README.md` insert before `## Installation`:

```markdown
## Changes in 17.1.0

- itsa-react-server renders with React 16 (was 15): apps need `react` and `react-dom` ^16. The
  rendered markup is unchanged. The default manifest's external modules point at React 16's `umd/`
  files.
- Fixed a memory leak on every page render (2-6 KB per page). A long-running worker ended with
  `FATAL ERROR ... out of memory`; in PM2 cluster mode that message only shows up in
  `~/.pm2/pm2.log`, not in the app's own error log.
- Fixed a memory leak in the socket server: websocket compression is off and socket.io is 2.5
  (browsers get socket.io-client 2.5.0 after the next build, and a vanished client is dropped after
  45 s instead of 30 s). A client message may still be 100 MB; set `socketServer.maxHttpBufferSize`
  (bytes) in the manifest to lower it.
- Fixed: on Node.js 16 and later, requests with a payload (POST, PUT, ...) got no response (a hapi 16
  issue, worked around by this package).
- Fixed: on Node.js 12 and later, pages logged an error for every missing `@phone`/`@tablet` model.
- Fixed: a malformed socket message could crash the process.
- Note: in PM2 cluster mode the workers run on the Node.js version of the PM2 daemon. After switching
  Node.js (for example with nvm), run `pm2 update`.
```

- [ ] **Step 6: Commit** (in `$WT`)

```bash
git add lib/hapi-plugin/helpers/request-close-fix.js lib/hapi-plugin/helpers/middleware.js tests/request-close-fix.test.js package.json package-lock.json README.md
git commit -m "FIXED: requests with a payload got no response on Node >= 16 (hapi 16); version 17.1.0

Since Node 16 IncomingMessage emits 'close' once the body has been read. hapi 16 took that for a
client disconnect and never answered POST, PUT, ... requests over real HTTP (server.inject is not
affected). On Node >= 16 an onRequest extension now detects a disconnect from the response's
'close' before it has ended, as hapi >= 20.2.1 does.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Part C — Verification on both lines

### Task 12: re-run the leak measurements against the fixed code

No repo changes. The harnesses from the investigation are in the session scratchpad
`/private/tmp/claude-501/-Users-marco-Documents-Projects-itsa-react-server/efd6eac2-ce12-44c9-a6b5-ac278e086a9b/scratchpad`:
`m-18http/` (run-inject.js, run-http.js; options include `--layout`, `--socket`, `--polyfill`, `--only`), `m-socket/` (`node driver.js <scenario> <on|off|force> <port 47200-47299>`, `run-linux.sh` for Docker), `m-17http/` (app/, harness/; the 17.x plugin installed into a fixture-app copy from an `npm pack` tarball, with npm `overrides`). Read each harness before running it. Use only ports 47100-47399. Kill every process you start.

- [ ] **Step 1: 18.x suite** — `cd /Users/marco/Documents/Projects/itsa-react-server && npm run lint && npm test` → 0 lint problems, all PASS; `git status --short` clean.
- [ ] **Step 2: 18.x page renders** — m-18http prod-layout with `--socket --polyfill`, series page-desktop, ajax-props, no-route-404, generated-props, WITHOUT the `--patch` memoization: every slope <= 20 B/unit (was 5558 and 2244).
- [ ] **Step 3: 18.x socket churn** — m-socket scenario B1 with the default setting (the server now passes `perMessageDeflate: false` itself), on macOS and, if Docker is available, with `run-linux.sh`: RSS slope flat (was +10 KB per abrupt disconnect), limiter pending 0; scenario C with 400 clients still delivers every broadcast.
- [ ] **Step 4: 17.x suite** — `cd /Users/marco/Documents/Projects/itsa-react-server-17.1.0 && npm ci --no-audit --no-fund && npm test` → `npm ci` works from the rebuilt lock, 0 lint problems, all PASS.
- [ ] **Step 5: 17.x page renders and POST** — `npm pack` the 17.1.0 worktree and install that tarball into a copy of `m-17http/app` whose `package.json` uses react/react-dom `^16.14.0` (not 15.6.2) and whose npm `overrides` no longer pin socket.io 2.2.0 / engine.io 3.3.2 / React 15 (keep the other pins). Run plain-fixed page-desktop, view-404 and prod-default page-desktop: slopes <= 20 B/unit (were 2284 and 6387). Over real HTTP on Node 24, `POST /act/payload` answers 200 (it got no response before).
- [ ] **Step 6: Report** — a table per step: before (from the investigation) vs after, with the exact commands used.
