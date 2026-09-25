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
