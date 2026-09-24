'use strict';

const {test} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture');

test('register rejects when src/routes.js cannot be loaded (spec §6.1)', async () => {
    process.env.ITSA_FIXTURE_BROKEN_ROUTES = 'true';
    await assert.rejects(fixture.startServer('plain'), /fixture: broken routes/);
});
