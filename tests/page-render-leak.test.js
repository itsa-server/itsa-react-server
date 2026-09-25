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
