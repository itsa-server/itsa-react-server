'use strict';

// A clientconnected message without props threw inside socket.io's event dispatch
// (data.props.__appProps): an uncaught exception that ended the whole worker.
// The bad messages must not be stored or answered, not merely fail to crash the server.

const {test, before, after} = require('node:test'),
    assert = require('node:assert'),
    ioClient = require('socket.io-client'),
    Event = require('itsa-event'),
    SocketServer = require('../lib/socketio/socketserver'),
    PORT = 4798,
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

test('malformed clientconnected messages are ignored and the server keeps working', async () => {
    const good = connect(),
        bad = connect(),
        badReplies = [];
    let badServerSocket;
    await Promise.all([waitFor(good, 'connect', 5000), waitFor(bad, 'connect', 5000)]);
    bad.on('versionchanged', () => badReplies.push(true));
    [null, 'text', 42, [], {}, {props: null}, {props: 'text'}, {props: {}}, {props: {__appProps: null}}].forEach(data => {
        bad.emit('clientconnected', data);
    });
    // one client's messages are handled in order: once its 'otherconnected' arrives, every message above was handled
    badServerSocket = await new Promise(resolve => {
        Event.onceAfter('socketserver:otherconnected', e => resolve(e.socket));
        bad.emit('otherconnected', {});
    });
    good.emit('clientconnected', {props: {__appProps: {serverStartup: STARTUP-1}}});
    await waitFor(good, 'versionchanged', 5000);
    await new Promise(resolve => setTimeout(resolve, 100)); // time for a (wrong) reply to reach the bad client
    assert.strictEqual(SocketServer.getSocketServer().socketConnections.has(badServerSocket), false);
    assert.strictEqual(SocketServer.getSocketServer().socketConnections.size, 1);
    assert.deepStrictEqual(badReplies, []);
});
