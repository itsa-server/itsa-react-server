'use strict';

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture');

let server, userLogin;

const findCookie = (res, name) => fixture.parseSetCookies(res).find(cookie => cookie.name===name);
const login = payload => server.inject({method: 'POST', url: '/login', payload});
const page = async options => {
    const res = await server.inject(options);
    return {res, props: fixture.readViewProps(res.payload)};
};

before(async () => {
    server = await fixture.startServer('auth');
});

test('an anonymous request to a protected route renders the login view (takeover)', async () => {
    const {res, props} = await page('/private');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['x-noauth'], 'true');
    assert.strictEqual(props.view, 'login');
    assert.strictEqual(props.authentication, false);
});

test('an anonymous ajax props request gets the login props with x-noauth', async () => {
    const res = await server.inject('/_itsa_server_ajax_/props/eee555/private');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['x-noauth'], 'true');
    assert.strictEqual(JSON.parse(res.payload).__appProps.view, 'login');
});

test('a protected route declared with the legacy `config:` key is protected (Review Focus 5)', async () => {
    const {res, props} = await page('/legacy-config-private');
    assert.strictEqual(res.headers['x-noauth'], 'true');
    assert.strictEqual(props.view, 'login');
});

test('client routes flag protected routes as private for `options:` and `config:` (Review Focus 5)', async () => {
    const routes = JSON.parse((await server.inject('/_itsa_server_ajax_/props/aaa111/public')).payload).__appProps.routes,
        privateView = routePath => routes.find(route => route.path===routePath).privateView;
    assert.strictEqual(privateView('/private'), true);
    assert.strictEqual(privateView('/legacy-config-private'), true);
    assert.strictEqual(privateView('/public'), false);
});

test('h.login sets itsa-id with SameSite=Lax and the manifest ttl', async () => {
    const cookie = findCookie(userLogin = await login({scope: 'user'}), 'itsa-id');
    assert.strictEqual(userLogin.statusCode, 200);
    assert.ok(cookie.value.startsWith('Fe26.2**'));
    assert.strictEqual(cookie.attributes.samesite, 'Lax');
    assert.strictEqual(cookie.attributes['max-age'], '1800');
    assert.strictEqual(cookie.attributes.httponly, true);
});

test('the auth cookie opens the protected route', async () => {
    const {res, props} = await page({url: '/private', headers: {cookie: fixture.cookieHeader(userLogin)}});
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['x-noauth'], undefined);
    assert.strictEqual(props.view, 'private');
    assert.strictEqual(props.loggedIn, true);
    assert.strictEqual(props.scope, 'user');
});

test('an insufficient scope (403) renders the login view', async () => {
    const {res, props} = await page({url: '/admin', headers: {cookie: fixture.cookieHeader(userLogin)}});
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['x-noauth'], 'true');
    assert.strictEqual(props.view, 'login');
});

test('a string from validateFunc becomes the login message', async () => {
    const blocked = await login({scope: 'user', blocked: true}),
        {props} = await page({url: '/private', headers: {cookie: fixture.cookieHeader(blocked)}});
    assert.strictEqual(props.view, 'login');
    assert.strictEqual(props.authenticationMsg, 'Account blocked');
});

test('h.logout in an action unsets itsa-id', async () => {
    const res = await server.inject({method: 'POST', url: '/logout', headers: {cookie: fixture.cookieHeader(userLogin)}}),
        cookie = findCookie(res, 'itsa-id');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(cookie.value, '');
    assert.strictEqual(cookie.attributes['max-age'], '0');
});

test('validateFunc receives h and h.logout() unsets itsa-id, also when the login view renders', async () => {
    const {res, props} = await page({url: '/private?logout=toolkit', headers: {cookie: fixture.cookieHeader(userLogin)}}),
        cookie = findCookie(res, 'itsa-id');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(props.view, 'login');
    assert.ok(cookie, 'a Set-Cookie for itsa-id is sent');
    assert.strictEqual(cookie.value, '');
    assert.strictEqual(cookie.attributes['max-age'], '0');
    assert.strictEqual(props.loggedIn, false);
});

test('a service-worker init request is authenticated with the route scope', async () => {
    const {res, props} = await page({url: '/private', headers: {'x-itsa-serviceworker-init': 'true'}});
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['x-noauth'], undefined);
    assert.strictEqual(props.view, 'private');
});
