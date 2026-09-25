'use strict';

// socketServer.maxHttpBufferSize in the manifest reaches engine.io (plugin.js passes it to start()).

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    SocketServer = require('../lib/socketio/socketserver'),
    PORT = 4803;

before(() => {
    SocketServer.start({host: '127.0.0.1', port: PORT, serverStartupTime: 1, maxHttpBufferSize: 5000000});
});

test('the configured largest client message is used', () => {
    assert.strictEqual(SocketServer.getSocketServer().socketIO.eio.maxHttpBufferSize, 5000000);
});
