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
