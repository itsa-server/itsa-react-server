'use strict';

// The external modules in the default manifest point at files inside node_modules; React 16 has no
// dist/ folder any more (its UMD builds are in umd/), so every path must exist with React 16.

const {test} = require('node:test'),
    assert = require('node:assert'),
    fs = require('fs'),
    path = require('path'),
    ROOT = path.resolve(__dirname, '..'),
    manifest = require('../lib/default-manifest.json');

const externalFiles = (value, found) => {
    if (Array.isArray(value)) {
        value.forEach(item => externalFiles(item, found));
    }
    else if (value && (typeof value==='object')) {
        if (value.module && value.file) {
            found.push(value.file);
        }
        Object.keys(value).forEach(key => externalFiles(value[key], found));
    }
    return found;
};

test('every external-module file of the default manifest exists', () => {
    const files = externalFiles(manifest, []);
    assert.ok(files.length>0);
    assert.deepStrictEqual(files.filter(file => !fs.existsSync(path.join(ROOT, 'node_modules', file))), []);
});
