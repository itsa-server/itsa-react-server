'use strict';

// One-off, run BEFORE lib/ is migrated:  node tests/parity/record-hapi16.js
// Copies the fixture app, overlays the hapi 16 (`reply` style) files, runs every configuration on the
// hapi 16 plugin in its own process and writes tests/fixtures/parity-hapi16.json.
// The copy lives inside the repo so `react` and `boom` resolve from the repo's node_modules.

const fs = require('fs-extra'),
    path = require('path'),
    execFileSync = require('child_process').execFileSync,
    REPO = path.resolve(__dirname, '..', '..'),
    APP = path.join(REPO, 'tests', 'fixtures', 'app'),
    OVERLAY = path.join(REPO, 'tests', 'fixtures', 'app-hapi16'),
    TMP_APP = path.join(REPO, 'tests', 'fixtures', '.tmp-app-hapi16'),
    OUT = path.join(REPO, 'tests', 'fixtures', 'parity-hapi16.json'),
    CONFIG_NAMES = Object.keys(require('../helpers/configs'));

const snapshot = {};

fs.removeSync(TMP_APP);
fs.copySync(APP, TMP_APP, {filter: src => (path.basename(src)!=='node_modules')});
fs.copySync(OVERLAY, TMP_APP);

CONFIG_NAMES.forEach(configName => {
    const outFile = path.join(TMP_APP, 'result-'+configName+'.json');
    execFileSync(process.execPath, [path.join(__dirname, 'runner.js'), '16', configName, TMP_APP, outFile], {stdio: 'inherit'});
    snapshot[configName] = fs.readJsonSync(outFile);
});

fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2)+'\n');
fs.removeSync(TMP_APP);
console.log('recorded', OUT);
