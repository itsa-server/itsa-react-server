'use strict';

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture');

let server;

before(async () => {
    // limit 3 requests; a long check interval so the table is not reset during the test
    server = await fixture.startServer('plain', {'ddos-prevention': {limit: 3, checkinterval: 60}});
});

test('requests over the ddos limit get the configured status and message', async () => {
    const statuses = [];
    let last;
    for (let i = 0; i<5; i++) {
        last = await server.inject({url: '/act/value', headers: {'user-agent': 'ddos-test-agent'}});
        statuses.push(last.statusCode);
    }
    assert.deepStrictEqual(statuses, [200, 200, 200, 429, 429]);
    assert.strictEqual(last.payload, 'Error');
});
