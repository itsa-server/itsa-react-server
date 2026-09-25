'use strict';

const {test} = require('node:test'),
    assert = require('node:assert'),
    path = require('path'),
    fixture = require('./helpers/fixture'),
    SAMPLES = require('./parity/render-samples'),
    recorded = require('./fixtures/react15-render.json'),
    View = require(path.join(fixture.REPO, 'lib', 'hapi-plugin', 'helpers', 'jsx-view')).View;

Object.keys(SAMPLES).forEach(name => {
    test('jsx-view renders "'+name+'" exactly as React 15 did', () => {
        const filename = path.join(fixture.FIXTURE_APP, 'build', 'view_components', SAMPLES[name].view+'.js');
        assert.strictEqual(View.compile('', {})(SAMPLES[name].props, {filename}), recorded[name]);
    });
});
