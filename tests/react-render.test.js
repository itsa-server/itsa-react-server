'use strict';

// 17.1.0 renders with React 16 (was 15). The markup must stay what React 15 gave (recorded through
// this jsx-view on React 15: tests/fixtures/react15-render.json), and the deprecated
// React.createFactory must not be used (React 16 warns about it).

const {test} = require('node:test'),
    assert = require('node:assert'),
    path = require('path'),
    SAMPLES = require('./parity/render-samples'),
    recorded = require('./fixtures/react15-render.json'),
    View = require('../lib/hapi-plugin/helpers/jsx-view').View,
    VIEWS = path.join(__dirname, 'fixtures', 'views');

// first: React warns only once per process
test('rendering uses no deprecated React API', () => {
    const originalWarn = console.warn,
        originalError = console.error,
        messages = [];
    console.warn = (...args) => messages.push(args.join(' '));
    console.error = (...args) => messages.push(args.join(' '));
    try {
        View.compile('', {})(SAMPLES.index.props, {filename: path.join(VIEWS, 'index.js')});
    }
    finally {
        console.warn = originalWarn;
        console.error = originalError;
    }
    assert.deepStrictEqual(messages.filter(message => /deprecated/i.test(message)), []);
});

Object.keys(SAMPLES).forEach(name => {
    test('jsx-view renders "'+name+'" exactly as React 15 did', () => {
        const filename = path.join(VIEWS, SAMPLES[name].view+'.js');
        assert.strictEqual(View.compile('', {})(SAMPLES[name].props, {filename}), recorded[name]);
    });
});
