'use strict';

const {test, before} = require('node:test'),
    assert = require('node:assert'),
    fixture = require('./helpers/fixture'),
    rejections = [];

// Review Focus 1: route discovery must not leave rejected promises behind (fatal on Node 24)
process.on('unhandledRejection', reason => {
    rejections.push(reason);
});

let server;

before(async () => {
    server = await fixture.startServer('plain');
    await new Promise(resolve => setImmediate(resolve));
});

test('registers on hapi 21 under its own name and version', () => {
    const registration = server.registrations['itsa-react-server'];
    assert.ok(registration);
    assert.strictEqual(registration.version, require('../package.json').version);
});

test('decorates server.manifest with the environment-merged manifest', () => {
    assert.strictEqual(server.manifest.envName, 'test');
    assert.strictEqual(server.manifest.port, 3999);
    assert.strictEqual(server.manifest.host, '127.0.0.1');
    assert.strictEqual(server.manifest.packageVersion, '1.0.0');
    assert.strictEqual(server.manifest.defaultLanguage, 'en');
});

test('registers inert and vision', () => {
    assert.ok(server.registrations['@hapi/inert']);
    assert.ok(server.registrations['@hapi/vision']);
});

test('client-route discovery leaves no unhandled rejections (async handlers)', () => {
    assert.deepStrictEqual(rejections, []);
});

test('getServerOptions resolves host and port for NODE_ENV', () => {
    const plugin = require('..'),
        manifest = fixture.buildManifest(fixture.FIXTURE_APP, 'plain'),
        previous = process.env.NODE_ENV;
    try {
        process.env.NODE_ENV = 'test';
        assert.deepStrictEqual(plugin.getServerOptions(manifest), {host: '127.0.0.1', port: 3999});
        process.env.NODE_ENV = 'production';
        assert.deepStrictEqual(plugin.getServerOptions(manifest), {host: '0.0.0.0', port: 8080});
        delete process.env.NODE_ENV; // 'local': no environment entry, so the base values
        assert.deepStrictEqual(plugin.getServerOptions(manifest), {host: '0.0.0.0', port: 3001});
    }
    finally {
        process.env.NODE_ENV = previous;
    }
});

test('does not register inert and vision twice when the app already did', async () => {
    const Hapi = require('@hapi/hapi'),
        plugin = require('..'),
        manifest = fixture.buildManifest(fixture.FIXTURE_APP, 'plain'),
        other = Hapi.server(plugin.getServerOptions(manifest));
    await other.register([require('@hapi/inert'), require('@hapi/vision')]);
    await other.register({plugin, options: manifest});
    assert.ok(other.registrations['itsa-react-server']);
});
