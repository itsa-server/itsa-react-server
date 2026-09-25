'use strict';

// getVersion() runs on every page render (assets-handler, build-props): it must read package.json
// without keeping anything. With require-reload every call left one Module in module.children.

const {test, before, after} = require('node:test'),
    assert = require('node:assert'),
    fs = require('fs'),
    os = require('os'),
    path = require('path'),
    START_DIR = process.cwd(),
    APP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'itsa-fpv-')));

let findPackageVersion, fpvModule;

const writePackage = (dir, content) => {
    fs.mkdirSync(path.join(APP, dir), {recursive: true});
    fs.writeFileSync(path.join(APP, dir, 'package.json'), content);
};

before(() => {
    writePackage('', JSON.stringify({name: 'app', version: '3.2.1'}));
    writePackage('node_modules/some-package', JSON.stringify({name: 'some-package', version: '1.2.3'}));
    writePackage('node_modules/bom-package', '\uFEFF'+JSON.stringify({name: 'bom-package', version: '7.0.0'}));
    writePackage('externals/external-package', JSON.stringify({name: 'external-package', version: '4.5.6'}));
    // find-package-version reads process.cwd() when it loads
    process.chdir(APP);
    findPackageVersion = require('../lib/find-package-version');
    fpvModule = require.cache[require.resolve('../lib/find-package-version')];
});

after(() => {
    process.chdir(START_DIR);
    fs.rmSync(APP, {recursive: true, force: true});
});

test('reads the version of an installed package, also for a file inside it', () => {
    assert.strictEqual(findPackageVersion.getVersion('some-package'), '1.2.3');
    assert.strictEqual(findPackageVersion.getVersion('some-package/dist/some.js'), '1.2.3');
});

test('reads a package.json that starts with a byte order mark', () => {
    assert.strictEqual(findPackageVersion.getVersion('bom-package'), '7.0.0');
});

test('falls back to externals/', () => {
    assert.strictEqual(findPackageVersion.getVersion('external-package'), '4.5.6');
});

test('without a module it reads the app itself', () => {
    assert.strictEqual(findPackageVersion.getVersion(), '3.2.1');
});

test('a missing package gives 0.0.1 and a warning', () => {
    const originalWarn = console.warn,
        warnings = [];
    console.warn = (...args) => warnings.push(args);
    try {
        assert.strictEqual(findPackageVersion.getVersion('missing-package'), '0.0.1');
    }
    finally {
        console.warn = originalWarn;
    }
    assert.deepStrictEqual(warnings, [['Package', 'missing-package', 'seems not to be installed']]);
});

test('a changed package.json is read again', () => {
    writePackage('node_modules/changing-package', JSON.stringify({version: '1.0.0'}));
    assert.strictEqual(findPackageVersion.getVersion('changing-package'), '1.0.0');
    writePackage('node_modules/changing-package', JSON.stringify({version: '1.0.1'}));
    assert.strictEqual(findPackageVersion.getVersion('changing-package'), '1.0.1');
});

test('repeated lookups keep no modules', () => {
    const childrenBefore = fpvModule.children.length;
    for (let i = 0; i<1000; i++) {
        findPackageVersion.getVersion('some-package');
    }
    assert.strictEqual(fpvModule.children.length, childrenBefore);
    assert.deepStrictEqual(Object.keys(require.cache).filter(file => file.startsWith(APP)), []);
});
