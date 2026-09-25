'use strict';

// hapi 16 on Node >= 16 left every request with a payload unanswered: since Node 16 the request's
// 'close' event also fires once the body has been read, and hapi 16 takes it for a client disconnect
// (https://github.com/hapijs/hapi/issues/4298). Only real HTTP shows it; server.inject does not.

const {test, before, after} = require('node:test'),
    assert = require('node:assert'),
    http = require('http'),
    stream = require('stream'),
    Hapi = require('hapi'),
    requestCloseFix = require('../lib/hapi-plugin/helpers/request-close-fix');

let server, port,
    closedRequests = 0,
    appCloses = 0,
    disconnects = 0,
    streamClosed = false,
    postDisconnects = 0,
    postStreamClosed = false;

const call = (method, body, agent, path) => new Promise((resolve, reject) => {
    const headers = (body===undefined) ? {} : {'content-type': 'application/json', 'content-length': Buffer.byteLength(body)},
        req = http.request({host: '127.0.0.1', port, path: path || '/echo', method, headers, agent, timeout: 3000}, res => {
            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });
            res.on('end', () => resolve({statusCode: res.statusCode, body: data}));
        });
    req.on('timeout', () => {
        req.destroy();
        reject(new Error(method+' got no response'));
    });
    req.on('error', reject);
    req.end(body);
});

before(() => new Promise((resolve, reject) => {
    server = new Hapi.Server();
    server.connection({host: '127.0.0.1', port: 0});
    requestCloseFix.apply(server);
    server.route({method: '*', path: '/echo', handler: (request, reply) => reply({method: request.method, payload: request.payload})});
    server.route({method: 'POST', path: '/slow', handler: (request, reply) => {
        setTimeout(() => reply('late'), 300);
    }});
    server.route({method: 'POST', path: '/listen', handler: (request, reply) => {
        request.raw.req.once('close', () => {
            appCloses++;
        });
        return reply('ok');
    }});
    server.route({method: 'POST', path: '/finished', config: {payload: {output: 'stream', parse: false}, handler: (request, reply) => {
        request.payload.resume();
        stream.finished(request.payload, () => {
            reply('done');
        });
    }}});
    server.route({method: 'GET', path: '/stream', handler: (request, reply) => {
        const source = new stream.Readable({read() {}});
        source.push('chunk');
        source.on('close', () => {
            streamClosed = true;
        });
        request.once('disconnect', () => {
            disconnects++;
        });
        return reply(source);
    }});
    server.route({method: 'POST', path: '/stream-post', handler: (request, reply) => {
        // the body has been read (default payload parsing): the request's early 'close' detaches
        // transmit.js's listener from it, so the disconnect is seen from the response only
        const source = new stream.Readable({read() {}});
        source.push('chunk');
        source.on('close', () => {
            postStreamClosed = true;
        });
        request.once('disconnect', () => {
            postDisconnects++;
        });
        return reply(source);
    }});
    server.on('request-internal', (request, event, tags) => {
        if (tags.closed) {
            closedRequests++;
        }
    });
    server.start(err => {
        if (err) {
            return reject(err);
        }
        port = server.info.port;
        resolve();
    });
}));

after(() => new Promise(resolve => server.stop(resolve)));

test('a POST with a body is answered', async () => {
    const closedBefore = closedRequests,
        res = await call('POST', JSON.stringify({a: 1}));
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(res.body), {method: 'post', payload: {a: 1}});
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.strictEqual(closedRequests, closedBefore);
});

test('an app listener for the request close event still runs', async () => {
    const res = await call('POST', '{}', undefined, '/listen');
    assert.strictEqual(res.statusCode, 200);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.strictEqual(appCloses, 1);
});

test('an empty POST is answered', async () => {
    const res = await call('POST', '');
    assert.strictEqual(res.statusCode, 200);
});

test('a GET is still answered', async () => {
    const res = await call('GET');
    assert.strictEqual(res.statusCode, 200);
});

test('several POSTs over one keep-alive connection are all answered', async () => {
    const agent = new http.Agent({keepAlive: true, maxSockets: 1});
    try {
        for (let i = 0; i<3; i++) {
            assert.strictEqual((await call('POST', JSON.stringify({i}), agent)).statusCode, 200);
        }
    }
    finally {
        agent.destroy();
    }
});

test('a raw payload stream reaches its end and the request is answered', async () => {
    const res = await call('POST', JSON.stringify({a: 1}), undefined, '/finished');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body, 'done');
});

test('a client that disconnects before the response is still detected', async () => {
    const closedBefore = closedRequests;
    await new Promise(resolve => {
        const req = http.request({host: '127.0.0.1', port, path: '/slow', method: 'POST', headers: {'content-type': 'application/json', 'content-length': 2}});
        req.on('error', () => {});
        req.end('{}');
        setTimeout(() => {
            req.destroy();
            resolve();
        }, 100);
    });
    await new Promise(resolve => setTimeout(resolve, 400));
    assert.strictEqual(closedRequests, closedBefore+1);
});

test('a client that disconnects while the response streams is detected and the source stream is closed', async () => {
    await new Promise(resolve => {
        const req = http.request({host: '127.0.0.1', port, path: '/stream', method: 'GET', timeout: 3000}, res => {
            res.once('data', () => {
                req.destroy();
            });
        });
        req.on('error', () => {});
        req.end();
        setTimeout(resolve, 300);
    });
    assert.strictEqual(disconnects, 1);
    assert.strictEqual(streamClosed, true);
});

test('a client that disconnects while a POST response streams is detected and the source stream is closed', async () => {
    let received = false;
    await new Promise(resolve => {
        const req = http.request({host: '127.0.0.1', port, path: '/stream-post', method: 'POST', headers: {'content-type': 'application/json', 'content-length': 2}, timeout: 3000}, res => {
            res.once('data', () => {
                received = true;
                req.destroy();
            });
        });
        req.on('error', () => {});
        req.end('{}');
        setTimeout(resolve, 300);
    });
    assert.strictEqual(received, true); // the response did stream: the disconnect came mid-response
    assert.strictEqual(postDisconnects, 1);
    assert.strictEqual(postStreamClosed, true);
});
