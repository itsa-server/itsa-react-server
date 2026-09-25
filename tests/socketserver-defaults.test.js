'use strict';

// The socket server enabled without `sequentialClientUpdate` in the manifest (the itsa-cli templates
// ship exactly that): pages must still render.

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture'),
    PORT = 4794;

let server;

before(async () => {
    server = await fixture.startServer('plain', {
        socketServer: {enabled: true, host: '127.0.0.1', port: PORT, 'proxy-port': PORT}
    });
});

test('pages render when the manifest has no sequentialClientUpdate', async () => {
    const res = await server.inject('/'),
        props = await server.inject('/_itsa_server_ajax_/props/aaa111/');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(props.statusCode, 200);
    assert.strictEqual(JSON.parse(props.payload).__appProps['delayed-response'], false);
});
