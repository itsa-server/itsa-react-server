'use strict';

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture');

let server;

before(async () => {
    server = await fixture.startServer('plain');
});

test('an action returning a value sends it as JSON', async () => {
    const res = await server.inject('/act/value');
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(res.payload), {hello: 'world', language: 'en'});
});

test('an action returning nothing sends {status: "OK"} (route declared with `options:`)', async () => {
    const res = await server.inject('/act/empty');
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(res.payload), {status: 'OK'});
});

test('an action can return h.response() with code and headers (route declared with legacy `config:`)', async () => {
    const res = await server.inject('/act/response');
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.headers['x-custom'], 'yes');
    assert.deepStrictEqual(JSON.parse(res.payload), {created: true});
});

test('an action can return a stream with headers', async () => {
    const res = await server.inject('/act/stream');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload, 'chunk-1,chunk-2');
    assert.strictEqual(res.headers['content-disposition'], 'attachment; filename="data.txt"');
});

test('a thrown Boom error keeps its status (spec §6.2); a 409, because a 404 on an extensionless path becomes the pageNotFoundView page', async () => {
    const res = await server.inject('/act/boom');
    assert.strictEqual(res.statusCode, 409);
    assert.strictEqual(JSON.parse(res.payload).message, 'Project locked');
});

test('a thrown non-Boom error becomes a generic 500', async () => {
    const res = await server.inject('/act/throws');
    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(JSON.parse(res.payload).message, 'An internal server error occurred');
    assert.ok(!res.payload.includes('secret internals'));
});

test('a missing action file becomes a 500', async () => {
    assert.strictEqual((await server.inject('/act/missing')).statusCode, 500);
});

test('an action module that does not export a function becomes a 500', async () => {
    assert.strictEqual((await server.inject('/act/not-a-function')).statusCode, 500);
});

test('an unmigrated action calling h() logs the migration hint', async () => {
    const logged = [],
        original = console.error;
    let res;
    console.error = (...args) => {
        logged.push(args.map(String).join(' '));
    };
    try {
        res = await server.inject('/act/legacy');
    }
    finally {
        console.error = original;
    }
    assert.strictEqual(res.statusCode, 500);
    assert.ok(logged.some(line => line.includes('actions must return a value or h.response(...)')), logged.join('\n'));
});

test('action options and language are passed through', async () => {
    assert.deepStrictEqual(JSON.parse((await server.inject('/act/options')).payload), {options: {inline: true}, language: 'en'});
    assert.strictEqual(JSON.parse((await server.inject({url: '/act/value', headers: {'x-lang': 'nl'}})).payload).language, 'nl');
});

test('a POST payload reaches the action', async () => {
    const res = await server.inject({method: 'POST', url: '/act/payload', payload: {a: 1}});
    assert.deepStrictEqual(JSON.parse(res.payload), {payload: {a: 1}});
});
