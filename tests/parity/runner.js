'use strict';

// usage: node tests/parity/runner.js <16|21> <configName> <appDir> <outFile>
// Starts ONE fixture configuration on hapi 16 or hapi 21 in this process, replays its parity
// requests and writes the normalized records to <outFile> (stdout is left to the plugin's logging).

const fs = require('fs'),
    path = require('path'),
    fixture = require('../helpers/fixture'),
    REQUESTS = require('./requests'),
    normalizeResponse = require('./normalize').normalizeResponse,
    flavor = process.argv[2],
    configName = process.argv[3],
    appDir = path.resolve(process.argv[4]),
    outFile = path.resolve(process.argv[5]);

const createServer16 = async manifest => {
    const Hapi = require(path.join(fixture.REPO, 'node_modules', 'hapi')),
        plugin = require(fixture.REPO),
        server = new Hapi.Server();
    await new Promise((resolve, reject) => {
        server.register({register: plugin, options: manifest}, err => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
    return server;
};

const createServer21 = async manifest => {
    const Hapi = require('@hapi/hapi'),
        plugin = require(fixture.REPO),
        server = Hapi.server(plugin.getServerOptions(manifest));
    await server.register({plugin, options: manifest});
    await server.initialize();
    return server;
};

const buildCookieHeader = (jar, names, ownCookie) => {
    const values = {},
        parts = [];
    (names || []).forEach(name => {
        (jar[name] || []).forEach(line => {
            const nameValue = line.split(';')[0],
                index = nameValue.indexOf('='),
                cookieName = nameValue.substr(0, index),
                value = nameValue.substr(index+1);
            if (value==='') {
                delete values[cookieName];
            }
            else {
                values[cookieName] = value;
            }
        });
    });
    if (ownCookie) {
        parts.push(ownCookie);
    }
    Object.keys(values).forEach(name => {
        parts.push(name+'='+values[name]);
    });
    return parts.join('; ');
};

const run = async () => {
    const results = {},
        jar = {};
    let manifest, server;
    fixture.useFixture(configName, appDir);
    manifest = fixture.buildManifest(appDir, configName);
    server = (flavor==='16') ? await createServer16(manifest) : await createServer21(manifest);
    for (const spec of REQUESTS[configName]) {
        const headers = Object.assign({}, spec.headers),
            cookie = buildCookieHeader(jar, spec.cookiesFrom, headers.cookie);
        let res, setCookie;
        if (cookie) {
            headers.cookie = cookie;
        }
        res = await server.inject({method: spec.method || 'GET', url: spec.url, headers, payload: spec.payload});
        setCookie = res.headers['set-cookie'];
        jar[spec.name] = Array.isArray(setCookie) ? setCookie : (setCookie ? [setCookie] : []);
        results[spec.name] = normalizeResponse(res);
    }
    fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
};

run().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
