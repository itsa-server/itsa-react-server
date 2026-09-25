'use strict';

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fs = require('fs'),
    path = require('path'),
    fixture = require('./helpers/fixture'),
    IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

let server;

const page = async options => {
    const res = await server.inject(options);
    return {res, props: fixture.readViewProps(res.payload)};
};

before(async () => {
    server = await fixture.startServer('plain');
});

test('a full page renders the view with models merged into this.props', async () => {
    const {res, props} = await page('/');
    assert.strictEqual(res.statusCode, 200);
    assert.match(res.headers['content-type'], /^text\/html/);
    assert.ok(res.payload.startsWith('<!DOCTYPE html>'));
    assert.strictEqual(props.view, 'index');
    assert.strictEqual(props.title, 'Home');
    assert.strictEqual(props.lang, 'en');
    assert.strictEqual(props.path, '/');
    assert.strictEqual(props.device, 'desktop');
    assert.strictEqual(props.fromModel, 42);
    assert.strictEqual(props.modelGotToolkit, true);
    assert.strictEqual(props.general, 'yes');
    assert.strictEqual(props.generalGotToolkit, true);
    assert.strictEqual(props.authentication, true);
    assert.strictEqual(props.itsapagescript, '/assets/local/js/aaa111.js');
    assert.strictEqual(props.itsapagelinkcss, '/assets/local/css/aaa111.css');
});

test('uri keeps the query but drops the client timestamp', async () => {
    const {props} = await page('/?x=1&_ts=123');
    assert.strictEqual(props.uri, '/?x=1');
    assert.strictEqual(props.path, '/');
});

test('a language prefix renders in that language', async () => {
    const {props} = await page('/nl/');
    assert.strictEqual(props.lang, 'nl');
    assert.strictEqual(props.langprefix, '/nl');
    assert.strictEqual(props.title, 'Thuis');
    assert.strictEqual((await page('/nl')).props.path, '/');
});

test('a phone gets the @phone view and falls back to the base model', async () => {
    const {props} = await page({url: '/', headers: {'user-agent': IPHONE}});
    assert.strictEqual(props.view, 'index@phone');
    assert.strictEqual(props.device, 'phone');
    assert.strictEqual(props.title, 'Home phone');
    assert.strictEqual(props.itsapagescript, '/assets/local/js/bbb222.js');
    assert.strictEqual(props.fromModel, 42);
});

test('h.setBodyDataAttr reaches __bodyDataAttr', async () => {
    const {props} = await page('/bodydata');
    assert.deepStrictEqual(props.bodyDataAttr, {'data-theme': 'dark', 'data-count': '2'});
});

test('h.generateProps returns the props without rendering', async () => {
    const res = await server.inject('/generated-props');
    assert.deepStrictEqual(JSON.parse(res.payload), {view: 'index', fromModel: 42, general: 'yes', authentication: true});
});

test('ajax props return this.props as JSON without page assets', async () => {
    const res = await server.inject('/_itsa_server_ajax_/props/aaa111/'),
        body = JSON.parse(res.payload);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(body.__appProps.view, 'index');
    assert.strictEqual(body.fromModel, 42);
    assert.strictEqual(body.__appProps.itsapagescript, undefined);
    assert.ok(body.__appProps.routes.some(route => (route.path==='/') && (route.view==='index')));
});

test('ajax component and css are served with etag and a one-year ttl', async () => {
    const comp = await server.inject('/_itsa_server_ajax_/comp/aaa111/'),
        css = await server.inject('/_itsa_server_ajax_/css/aaa111/');
    assert.strictEqual(comp.statusCode, 200);
    assert.strictEqual(comp.payload, 'for(;;);window.itsaView=\'index\';');
    assert.strictEqual(comp.headers.etag, '"aaa111"');
    assert.match(comp.headers['cache-control'], /max-age=31536000/);
    assert.strictEqual(css.payload, 'h1{color:red}');
    assert.strictEqual(css.headers.etag, '"aaa111.css"');
});

test('ajax component for an unknown view is a 404', async () => {
    const res = await server.inject('/_itsa_server_ajax_/comp/aaa111/missing-view');
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.payload, 'file not found');
});

test('an unknown view serves src/file404.html with 404', async () => {
    const res = await server.inject('/missing-view');
    assert.strictEqual(res.statusCode, 404);
    assert.match(res.payload, /fixture 404/);
});

test('an unknown view without src/file404.html is a bare 404', async () => {
    const file404 = path.join(fixture.FIXTURE_APP, 'src', 'file404.html'),
        moved = file404+'.moved';
    let res;
    fs.renameSync(file404, moved);
    try {
        res = await server.inject('/missing-view');
    }
    finally {
        fs.renameSync(moved, file404);
    }
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.payload, '');
});

test('an unknown page path renders the pageNotFoundView', async () => {
    const {res, props} = await page('/does/not/exist');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(props.view, 'not-found');
});
