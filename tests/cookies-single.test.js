'use strict';

// Only the props cookie enabled, and HTTPS-only: its settings must not be mixed up with the
// body-data-attr cookie's (17.x passed the two configs to cookieHandler.register in swapped order).

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture'),
    PROPS_URL = '/_itsa_server_ajax_/props/aaa111/';

let server;

before(async () => {
    server = await fixture.startServer('plain', {
        cookies: {
            props: {enabled: true, onlySsl: true, 'ttl-sec': 600},
            'body-data-attr': {enabled: false, onlySsl: false, 'ttl-sec': 31536000},
            'not-exposed': {enabled: false, onlySsl: false, 'ttl-sec': 31536000}
        }
    });
});

test('pages render when only the props cookie is enabled', async () => {
    const res = await server.inject('/');
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(fixture.readViewProps(res.payload).cookie, {});
});

test('the props cookie gets its own settings: Secure and its own ttl', async () => {
    const res = await server.inject({url: PROPS_URL, headers: {'x-cookie': 'itsa-props', 'x-action': 'define', 'x-cookieprops': '{"a":1}'}}),
        cookie = fixture.parseSetCookies(res).find(item => item.name==='itsa-props');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(cookie, 'itsa-props is set');
    assert.strictEqual(cookie.attributes.secure, true);
    assert.strictEqual(cookie.attributes['max-age'], '600');
});
