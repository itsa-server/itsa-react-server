'use strict';

// Transport settings of the socket server (socket.io 2.5 / engine.io 3.6 / ws 7): websocket messages
// are not compressed (permessage-deflate leaked memory), large client messages are still accepted,
// and socket.io-client 2.x still connects.

const {test, before, after} = require('node:test'),
    assert = require('node:assert'),
    http = require('http'),
    path = require('path'),
    ioClient = require('socket.io-client'),
    SocketServer = require('../lib/socketio/socketserver'),
    PORT = 4797,
    STARTUP = 1234567890;

const clients = [];

const connect = () => {
    const client = ioClient('http://127.0.0.1:'+PORT, {transports: ['websocket'], forceNew: true, reconnection: false});
    clients.push(client);
    return client;
};

// resolves with the event's first argument, rejects after `ms`
const waitFor = (emitter, event, ms) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no '+event+' within '+ms+' ms')), ms);
    emitter.once(event, value => {
        clearTimeout(timer);
        resolve(value);
    });
});

const listening = async () => {
    let lastError;
    for (let attempt = 0; attempt<30; attempt++) {
        try {
            return await fetch('http://127.0.0.1:'+PORT+'/socket.io/?EIO=3&transport=polling');
        }
        catch (err) {
            lastError = err;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    throw lastError;
};

before(async () => {
    SocketServer.start({host: '127.0.0.1', port: PORT, serverStartupTime: STARTUP});
    await listening();
});

after(() => {
    clients.forEach(client => client.close());
});

test('a websocket upgrade does not negotiate permessage-deflate', async () => {
    const res = await new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1',
            port: PORT,
            path: '/socket.io/?EIO=3&transport=websocket',
            headers: {
                Connection: 'Upgrade',
                Upgrade: 'websocket',
                'Sec-WebSocket-Version': '13',
                'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
                'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits'
            }
        });
        req.on('upgrade', (response, socket) => {
            socket.destroy();
            resolve(response);
        });
        req.on('response', response => reject(new Error('no upgrade, status '+response.statusCode)));
        req.on('error', reject);
        req.end();
    });
    assert.strictEqual(res.statusCode, 101);
    assert.strictEqual(res.headers['sec-websocket-extensions'], undefined);
});

test('socket.io uses a ws without the stalled-compression bug (ws >= 7.1.2)', () => {
    const socketIoDir = path.dirname(require.resolve('socket.io/package.json')),
        engineIoDir = path.dirname(require.resolve('engine.io/package.json', {paths: [socketIoDir]})),
        version = require(require.resolve('ws/package.json', {paths: [engineIoDir]})).version,
        parts = version.split('.').map(Number);
    assert.ok((parts[0]>7) || ((parts[0]===7) && ((parts[1]>1) || ((parts[1]===1) && (parts[2]>=2)))), 'engine.io uses ws '+version);
});

test('without a manifest value a client message may be up to 100 MB', () => {
    assert.strictEqual(SocketServer.getSocketServer().socketIO.eio.maxHttpBufferSize, 1e8);
});

test('socket.io-client connects and hears that the server restarted', async () => {
    const client = connect();
    await waitFor(client, 'connect', 5000);
    client.emit('clientconnected', {props: {__appProps: {serverStartup: STARTUP-1}}});
    await waitFor(client, 'versionchanged', 5000);
});

test('a clientconnected message larger than 1 MB is accepted', async () => {
    const client = connect();
    await waitFor(client, 'connect', 5000);
    client.emit('clientconnected', {props: {__appProps: {serverStartup: STARTUP-1}, model: 'x'.repeat(2*1024*1024)}});
    await waitFor(client, 'versionchanged', 5000);
});
