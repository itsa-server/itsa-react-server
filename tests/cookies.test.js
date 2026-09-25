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
