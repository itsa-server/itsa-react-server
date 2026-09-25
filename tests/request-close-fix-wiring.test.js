'use strict';

// middleware.generate must register the hapi 16 request-close fix: without it every request with a
// payload got no response on Node >= 16, while request-close-fix.test.js (which applies the fix
// itself) still passed.

const {test, after} = require('node:test'),
    assert = require('node:assert'),
    EventEmitter = require('events'),
    Ddos = require('../lib/hapi-plugin/helpers/ddos-prevention'),
    middleware = require('../lib/hapi-plugin/helpers/middleware');

const ddosInstances = [],
    startTimers = Ddos.prototype.startTimers;

// keep the ddos instances that generate creates, to stop their timers afterwards
Ddos.prototype.startTimers = function() {
    ddosInstances.push(this);
    return startTimers.apply(this, arguments);
};

after(() => {
    Ddos.prototype.startTimers = startTimers;
    ddosInstances.forEach(ddos => ddos.destroy());
});

test('middleware.generate applies the request-close fix to every request', async () => {
    const onRequest = [],
        server = {
            root: {
                ext: (event, fn) => {
                    if (event==='onRequest') {
                        onRequest.push(fn);
                    }
                }
            }
        },
        appConfig = {'ddos-prevention': {}, languages: {en: {}}, defaultLanguage: 'en', envName: 'production'},
        onClose = () => {},
        req = new EventEmitter(),
        res = new EventEmitter(),
        request = {
            _onClose: onClose,
            raw: {req, res},
            headers: {},
            info: {remoteAddress: '127.0.0.1'},
            path: '/',
            url: {pathname: '/', path: '/', href: '/'}
        },
        reply = () => ({code: () => {}});
    reply.continue = () => {};
    req.once('close', onClose); // as hapi 16's request.js does
    await middleware.generate(server, [], appConfig);
    assert.ok(ddosInstances.length>0);
    onRequest.forEach(fn => fn(request, reply));
    // request.js's close listener moved from the request to the response
    assert.strictEqual(req.listeners('close').includes(onClose), false);
    assert.strictEqual(res.listenerCount('close'), 1);
    // and the request's emit is wrapped (for transmit.js's listener)
    assert.ok(Object.prototype.hasOwnProperty.call(req, 'emit'));
});
