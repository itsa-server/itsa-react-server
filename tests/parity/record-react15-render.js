'use strict';

// One-off, run while React 15 is installed:  node tests/parity/record-react15-render.js
// Renders the samples through jsx-view and writes tests/fixtures/react15-render.json.

const fs = require('fs'),
    path = require('path'),
    fixture = require('../helpers/fixture'),
    SAMPLES = require('./render-samples'),
    View = require(path.join(fixture.REPO, 'lib', 'hapi-plugin', 'helpers', 'jsx-view')).View,
    OUT = path.join(fixture.REPO, 'tests', 'fixtures', 'react15-render.json'),
    rendered = {};

console.log('react', require('react/package.json').version);
Object.keys(SAMPLES).forEach(name => {
    const filename = path.join(fixture.FIXTURE_APP, 'build', 'view_components', SAMPLES[name].view+'.js');
    rendered[name] = View.compile('', {})(SAMPLES[name].props, {filename});
});
fs.writeFileSync(OUT, JSON.stringify(rendered, null, 2)+'\n');
console.log('recorded', OUT);
