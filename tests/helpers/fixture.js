'use strict';

const fs = require('fs'),
    path = require('path'),
    CONFIGS = require('./configs'),
    REPO = path.resolve(__dirname, '..', '..'),
    FIXTURE_APP = path.join(REPO, 'tests', 'fixtures', 'app');

const isObject = value => (value!==null) && (typeof value==='object') && !Array.isArray(value);

const deepMerge = (target, source) => {
    Object.keys(source).forEach(key => {
        if (isObject(source[key]) && isObject(target[key])) {
            deepMerge(target[key], source[key]);
        }
        else {
            target[key] = source[key];
        }
    });
    return target;
};

// the plugin reads files through `<cwd>/node_modules/itsa-react-server/...`
const linkPackage = appDir => {
    const modulesDir = path.join(appDir, 'node_modules'),
        link = path.join(modulesDir, 'itsa-react-server');
    fs.mkdirSync(modulesDir, {recursive: true});
    if (!fs.existsSync(link)) {
        fs.symlinkSync(REPO, link, 'dir');
    }
};

// Must run BEFORE the plugin is required: plugin modules read process.cwd() when they load.
const useFixture = (configName, appDir) => {
    const config = CONFIGS[configName];
    appDir = appDir || FIXTURE_APP;
    process.env.NODE_ENV = 'test';
    Object.keys(config.env).forEach(key => {
        process.env[key] = config.env[key];
    });
    linkPackage(appDir);
    process.chdir(appDir);
    return appDir;
};

const buildManifest = (appDir, configName, extraOverrides) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(appDir, 'src', 'manifest.json'), 'utf8'));
    deepMerge(manifest, JSON.parse(JSON.stringify(CONFIGS[configName].overrides)));
    if (extraOverrides) {
        deepMerge(manifest, extraOverrides);
    }
    return manifest;
};

// hapi 21 only (available from Task 2 on)
const startServer = async (configName, extraOverrides) => {
    const appDir = useFixture(configName),
        Hapi = require('@hapi/hapi'),
        plugin = require(REPO),
        manifest = buildManifest(appDir, configName, extraOverrides),
        server = Hapi.server(plugin.getServerOptions(manifest));
    await server.register({plugin, options: manifest});
    await server.initialize();
    return server;
};

const parseSetCookies = res => {
    const header = res.headers['set-cookie'],
        lines = Array.isArray(header) ? header : (header ? [header] : []);
    return lines.map(line => {
        const parts = line.split(';').map(part => part.trim()),
            nameValue = parts.shift(),
            index = nameValue.indexOf('='),
            attributes = {};
        parts.forEach(part => {
            const i = part.indexOf('=');
            if (i===-1) {
                attributes[part.toLowerCase()] = true;
            }
            else {
                attributes[part.substr(0, i).toLowerCase()] = part.substr(i+1);
            }
        });
        return {name: nameValue.substr(0, index), value: nameValue.substr(index+1), attributes};
    });
};

// builds a Cookie request header from the Set-Cookie headers of earlier responses (later ones win,
// an emptied cookie is dropped)
const cookieHeader = (...responses) => {
    const values = {};
    responses.forEach(res => {
        parseSetCookies(res).forEach(cookie => {
            if (cookie.value==='') {
                delete values[cookie.name];
            }
            else {
                values[cookie.name] = cookie.value;
            }
        });
    });
    return Object.keys(values).map(name => name+'='+values[name]).join('; ');
};

// reads the JSON the fixture views render into <pre id="props"> (React 15 escapes it as HTML)
const readViewProps = html => {
    const match = /<pre id="props">([\s\S]*?)<\/pre>/.exec(html);
    if (!match) {
        return null;
    }
    return JSON.parse(match[1]
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, '\'')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&'));
};

module.exports = {
    REPO,
    FIXTURE_APP,
    useFixture,
    buildManifest,
    startServer,
    parseSetCookies,
    cookieHeader,
    readViewProps
};
