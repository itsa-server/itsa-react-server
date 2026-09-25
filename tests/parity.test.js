'use strict';

// Replays the parity requests on hapi 21 and compares them with the hapi 16 snapshot
// (tests/fixtures/parity-hapi16.json). Only the differences in spec §7 are allowed.

const {test} = require('node:test'),
    assert = require('node:assert'),
    fs = require('fs'),
    os = require('os'),
    path = require('path'),
    execFileSync = require('child_process').execFileSync,
    fixture = require('./helpers/fixture'),
    snapshot = require('./fixtures/parity-hapi16.json'),
    RUNNER = path.join(__dirname, 'parity', 'runner.js');

// spec §7: request name → check of the hapi 21 record instead of an equality comparison
const INTENDED_DIFFERENCES = {
    // §7.2: a thrown Boom error keeps its own status (hapi 16 answered 500)
    'act-boom': actual => {
        assert.strictEqual(actual.status, 409);
        assert.match(actual.body.preview, /Project locked/);
    },
    // §7.6: .js files are served as text/javascript (RFC 9239) instead of application/javascript
    'asset-local': (actual, expected) => {
        assert.strictEqual(actual.contentType, 'text/javascript; charset=utf-8');
        assert.deepStrictEqual(Object.assign({}, actual, {contentType: null}), Object.assign({}, expected, {contentType: null}));
    },
    'asset-external': (actual, expected) => {
        assert.strictEqual(actual.contentType, 'text/javascript; charset=utf-8');
        assert.deepStrictEqual(Object.assign({}, actual, {contentType: null}), Object.assign({}, expected, {contentType: null}));
    },
    // §7.4: changeTtl sets the requested ttl in seconds (hapi 16 set Max-Age=0)
    'cookie-ttl': actual => {
        const cookie = actual.cookies.find(item => item.name==='itsa-props');
        assert.strictEqual(actual.status, 200);
        assert.ok(cookie && cookie.attributes.includes('max-age=600'), JSON.stringify(actual.cookies));
    }
};

// §7.1: SameSite is compared on its own
const withoutSameSite = record => Object.assign({}, record, {
    cookies: record.cookies.map(cookie => Object.assign({}, cookie, {sameSite: null}))
});

Object.keys(snapshot).forEach(configName => {
    test('parity with hapi 16: '+configName, () => {
        const outFile = path.join(os.tmpdir(), 'itsa-parity-21-'+configName+'-'+process.pid+'.json');
        let actual;
        execFileSync(process.execPath, [RUNNER, '21', configName, fixture.FIXTURE_APP, outFile], {stdio: ['ignore', 'ignore', 'inherit']});
        actual = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        fs.unlinkSync(outFile);
        Object.keys(snapshot[configName]).forEach(name => {
            const expected = snapshot[configName][name],
                got = actual[name];
            assert.ok(got, 'no hapi 21 record for '+name);
            got.cookies.forEach(cookie => {
                assert.strictEqual(cookie.sameSite, 'lax', name+': cookie '+cookie.name+' must be SameSite=Lax');
            });
            if (INTENDED_DIFFERENCES[name]) {
                INTENDED_DIFFERENCES[name](got, expected);
            }
            else {
                assert.deepStrictEqual(withoutSameSite(got), withoutSameSite(expected), 'request '+name+' differs from hapi 16');
            }
        });
    });
});
