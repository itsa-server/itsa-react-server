/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

/* eslint no-empty: 0*/
/* eslint no-cond-assign: 0*/
'use strict';

// first: enable the server from usging specific browser globals, like `window`, `document`, `navigator` etc:
require('jsdom-global')();
require('itsa-jsext');

if (typeof global.requestAnimationFrame!=='function') {
    global.requestAnimationFrame = function(){}; // prevent React serverside from error messaging
}
if (typeof global.cancelAnimationFrame!=='function') {
    global.cancelAnimationFrame = function(){}; // prevent React serverside from error messaging
}

const reload = require('require-reload')(require), // see https://github.com/fastest963/require-reload
    cwd = process.cwd(),
    Vision = require('@hapi/vision'),
    Inert = require('@hapi/inert'),
    pkg = require('../../package.json'),
    SocketServer = require('../socketio/socketserver'),
    cdnCleanup = require('../cdn-cleanup'),
    consoleDebug = require('./helpers/console-debug'), // create console.debug
    applyTitles = require('./helpers/apply-titles'),
    applyClientRoutes = require('./helpers/apply-client-routes'),
    middleware = require('./helpers/middleware'),
    serviceWorkerCacheList = require('./helpers/serviceworker-cache-list'),
    applyServerRoutes = require('./helpers/apply-server-routes'),
    getManifest = require('./helpers/get-manifest'),
    extendToolkit = require('./helpers/extend-toolkit'),
    defaultLanguage = require('./helpers/default-language');

let clientRoutes = {
        desktop: [],
        tablet: [],
        phone: []
    },
    VIEW_COMPONENT_NRS = {},
    VIEW_COMPONENT_COMMON = {},
    APP_TITELS = {},
    serviceWorkerCacheListViews = [];

const getEnvironment = () => process.env.NODE_ENV || 'local';

const applyBuildStats = async () => {
    const data = reload(cwd+'/build/build-stats.json');
    data.forEach(record => {
        if (record.name) {
            VIEW_COMPONENT_NRS[record.name] = {
                componentId: record.componentId,
                requireId: record.requireId,
                hash: record.hash,
                cssfile: record.cssfile
            };
        }
        else if (record.isCommon) {
            VIEW_COMPONENT_COMMON = {
                hash: record.hash,
                cssfile: record.cssfile
            };
        }
    });
};

const startSocketServer = (appConfig, startupTime) => {
    const localEnvironment = (getEnvironment()==='local');
    let host, port;
    if (appConfig.socketServer && appConfig.socketServer.enabled) {
        // setup custom socketio:
        host = appConfig.socketServer.host || appConfig.host || '0.0.0.0';
        port = appConfig.socketServer.port;
        if (localEnvironment || appConfig.debug) {
            console.log('starting socketserver on', host+':'+port);
        }
        SocketServer.start({
            host,
            port,
            serverStartupTime: startupTime,
            sequentialClientUpdate: appConfig.sequentialClientUpdate
        });
    }
};

// the host and port the app's hapi server should listen on, for the current NODE_ENV:
// hapi 21 needs them when the server is created, before this plugin is registered
const getServerOptions = manifest => {
    const appConfig = getManifest.generate(getEnvironment(), manifest);
    return {
        host: appConfig.host,
        port: appConfig.port
    };
};

// errors are not caught: `await server.register()` rejects, so a half-configured app never serves
const register = async (server, manifest) => {
    const startupTime = Date.now(); // needed to inform clients that the server is restarted, by: this.props.__serverStartup
    let appConfig, cacheList;

    if (!server.registrations['@hapi/inert']) {
        await server.register(Inert);
    }
    if (!server.registrations['@hapi/vision']) {
        await server.register(Vision);
    }

    appConfig = getManifest.generate(getEnvironment(), manifest);
    server.decorate('server', 'manifest', appConfig);
    consoleDebug.create(appConfig.debug);
    await defaultLanguage.generate(appConfig);
    await applyBuildStats();
    await applyTitles.generate(APP_TITELS, appConfig.languages);
    await applyClientRoutes.generate(clientRoutes, VIEW_COMPONENT_NRS, APP_TITELS, serviceWorkerCacheListViews, appConfig);
    await extendToolkit.extend(server, manifest, appConfig, VIEW_COMPONENT_COMMON, VIEW_COMPONENT_NRS, APP_TITELS, clientRoutes, startupTime);
    cacheList = await serviceWorkerCacheList.generate(serviceWorkerCacheListViews, appConfig);
    await middleware.generate(server, cacheList, appConfig);
    await applyServerRoutes.generate(server, cacheList, appConfig, startupTime);
    if (appConfig.debug) {
        consoleDebug.logRequests(server);
    }
    startSocketServer(appConfig, startupTime);
    cdnCleanup.cleanup();
};

module.exports = {
    name: 'itsa-react-server',
    version: pkg.version,
    register,
    getServerOptions
};
