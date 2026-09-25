'use strict';

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture'),
    PORT = 4791;

let server;

const poll = async url => {
    let lastError;
    for (let attempt = 0; attempt<30; attempt++) {
        try {
            return await fetch(url);
        }
        catch (err) {
            lastError = err;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    throw lastError;
};

before(async () => {
    server = await fixture.startServer('plain', {
        socketServer: {enabled: true, host: '127.0.0.1', port: PORT, 'proxy-port': PORT, maxHttpBufferSize: 5000000},
        sequentialClientUpdate: {delay: false}
    });
});

test('the socket server starts and answers socket.io polling', async () => {
    const res = await poll('http://127.0.0.1:'+PORT+'/socket.io/?EIO=3&transport=polling');
    assert.strictEqual(res.status, 200);
    assert.match(await res.text(), /"sid"/);
});

test('pages receive the socket port', async () => {
    const body = JSON.parse((await server.inject('/_itsa_server_ajax_/props/aaa111/')).payload);
    assert.strictEqual(body.__appProps.socketport, PORT);
});

test('the manifest sets the largest client message (socketServer.maxHttpBufferSize)', () => {
    const SocketServer = require('../lib/socketio/socketserver');
    assert.strictEqual(SocketServer.getSocketServer().socketIO.eio.maxHttpBufferSize, 5000000);
});
