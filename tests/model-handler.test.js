'use strict';

// Models are looked up per affinity: <view>@phone, <view>@tablet, <view>. A missing level is normal
// and must not be logged (on Node >= 12 it was: the MODULE_NOT_FOUND message got a "Require stack"),
// and is looked up only once. A model that fails to load must still be reported every time.

const {test, before, after, beforeEach} = require('node:test'),
    assert = require('node:assert'),
    fs = require('fs'),
    path = require('path'),
    Module = require('module'),
    REPO = path.resolve(__dirname, '..'),
    APP = fs.mkdtempSync(path.join(REPO, 'tests', 'fixtures', '.tmp-models-')),
    originalError = console.error,
    originalDebug = console.debug,
    originalLoad = Module._load;

let modelHandler, errors, loads;

const writeModel = (name, code) => {
    fs.writeFileSync(path.join(APP, 'src', 'models', name+'.js'), code);
};

const merge = async (view, device) => {
    const props = {__appProps: {device, lang: 'en'}};
    await modelHandler.merge({query: {}, params: {}, payload: null}, {}, props, {}, {debug: false}, view);
    return props;
};

before(() => {
    fs.mkdirSync(path.join(APP, 'src', 'models'), {recursive: true});
    writeModel('desktop-only', 'module.exports = () => ({fromModel: \'desktop-only\'});\n');
    writeModel('broken', 'require(\'itsa-no-such-module\');\nmodule.exports = () => ({});\n');
    writeModel('syntax-error', 'module.exports = (;\n');
    // model-handler reads process.cwd() when it loads
    process.chdir(APP);
    modelHandler = require('../lib/hapi-plugin/helpers/model-handler');
    console.error = (...args) => errors.push(args);
    console.debug = () => {};
    Module._load = function(request) {
        if (request.indexOf('/src/models/')!==-1) {
            loads.push(request);
        }
        return originalLoad.apply(this, arguments);
    };
});

beforeEach(() => {
    errors = [];
    loads = [];
});

after(() => {
    console.error = originalError;
    console.debug = originalDebug;
    Module._load = originalLoad;
    process.chdir(REPO);
    fs.rmSync(APP, {recursive: true, force: true});
});

test('a phone page with only a desktop model uses it and logs nothing', async () => {
    const props = await merge('desktop-only', 'phone');
    assert.strictEqual(props.fromModel, 'desktop-only');
    assert.deepStrictEqual(errors, []);
});

test('a view without any model logs nothing', async () => {
    await merge('no-model', 'tablet');
    assert.deepStrictEqual(errors, []);
});

test('a model that does not exist is looked up only once', async () => {
    let firstLoads;
    await merge('never-there', 'phone');
    firstLoads = loads.length;
    await merge('never-there', 'phone');
    await merge('never-there', 'phone');
    assert.strictEqual(firstLoads, 3);
    assert.strictEqual(loads.length, firstLoads);
});

test('a model that fails to load is reported on every request', async () => {
    await merge('broken', 'phone');
    await merge('broken', 'phone');
    await merge('syntax-error', 'phone');
    assert.strictEqual(errors.length, 3);
    assert.match(errors[0][0].message, /itsa-no-such-module/);
    assert.match(errors[1][0].message, /itsa-no-such-module/);
    assert.ok(errors[2][0] instanceof SyntaxError);
});
