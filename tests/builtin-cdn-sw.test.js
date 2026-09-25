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
