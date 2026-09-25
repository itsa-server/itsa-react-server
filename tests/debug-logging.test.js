'use strict';

const {test} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture');

test('debug mode logs each request and still serves it (Review Focus 2)', async () => {
    const server = await fixture.startServer('plain', {debug: true}),
        lines = [],
        original = console.log;
    let res;
    console.log = (...args) => {
        lines.push(args.map(arg => ((typeof arg==='string') ? arg : JSON.stringify(arg))).join(' '));
    };
    try {
        res = await server.inject('/act/value');
    }
    finally {
        console.log = original;
    }
    assert.strictEqual(res.statusCode, 200);
    assert.ok(lines.some(line => line.includes('GET') && line.includes('/act/value')), lines.join('\n'));
});
