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

const reload = require('require-reload')(require), // see https://github.com/fastest963/require-reload
    cwd = process.cwd(),
    Vision = require('vision'),
    Inert = require('inert'),
    SocketServer = require('../socketio/socketserver'),
    cdnCleanup = require('../cdn-cleanup'),
    environment = process.env.NODE_ENV || 'local',
    consoleDebug = require('./helpers/console-debug'), // create console.debug
    applyTitles = require('./helpers/apply-titles'),
    applyClientRoutes = require('./helpers/apply-client-routes'),
    middleware = require('./helpers/middleware'),
    serviceWorkerCacheList = require('./helpers/serviceworker-cache-list'),
    applyServerRoutes = require('./helpers/apply-server-routes'),
    getManifest = require('./helpers/get-manifest'),
    extendReply = require('./helpers/extend-reply'),
    defaultLanguage = require('./helpers/default-language');

let clientRoutes = {
        desktop: [],
        tablet: [],
        phone: []
    },
    VIEW_COMPONENT_NRS = {},
    VIEW_COMPONENT_COMMON = {},
    APP_TITELS = {},
    serviceWorkerCacheListViews = [],
    appConfig, startupTime;

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

const startSocketServer = (server, appConfig) => {
    const environment = process.env.NODE_ENV || 'local',
        localEnvironment = (environment==='local');
    if (appConfig.socketServer && appConfig.socketServer.enabled) {
        // setup custom socketio:
        if (localEnvironment || appConfig.debug) {
            console.log('starting socketserver on port', appConfig.socketServer.port);
        }
        SocketServer.start({
            socketPort: appConfig.socketServer.port,
            serverStartupTime: server.root._startupTime
        });
    }
};

const initialize = async (server, options, next) => {
    let cacheList;
    try {
        server.root.manifest = appConfig = getManifest.generate(environment, options);
        consoleDebug.create(appConfig.debug);
        await defaultLanguage.generate(appConfig);
        await applyBuildStats();
        await applyTitles.generate(APP_TITELS, appConfig.languages);
        await applyClientRoutes.generate(clientRoutes, VIEW_COMPONENT_NRS, APP_TITELS, serviceWorkerCacheListViews, appConfig);
        await extendReply.extend(server, options, appConfig, VIEW_COMPONENT_COMMON, VIEW_COMPONENT_NRS, APP_TITELS, clientRoutes, startupTime);
        cacheList = await serviceWorkerCacheList.generate(serviceWorkerCacheListViews, appConfig);
        await middleware.generate(server, cacheList, appConfig);
        await applyServerRoutes.generate(server, cacheList, appConfig, startupTime);
        appConfig.debug && consoleDebug.logRequests(server);
        startSocketServer(server, appConfig);
        cdnCleanup.cleanup();
        next();
    }
    catch (err) {
        console.error(err);
        next();
    }
};

const plugin = {
    async register(server, manifest, next) {
        let inertPromise, visionPromise;

        startupTime = Date.now(); // needed to inform clients that the server is restarted, by: this.props.__serverStartup
        server.root._startupTime = startupTime;

        inertPromise = server.plugins.inert ? Promise.resolve() : new Promise((resolve, reject) => {
            server.register({
                register: Inert
            }, err => {
                if (err) {
                    console.warn(err);
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });

        visionPromise = (server.root._replier._decorations && server.root._replier._decorations.view) ? Promise.resolve : new Promise((resolve, reject) => {
            server.register({
                register: Vision
            }, err => {
                if (err) {
                    console.warn(err);
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });

        await Promise.itsa_finishAll([
            inertPromise,
            visionPromise
        ]);

        initialize(server, manifest, next);
    }
};

plugin.register.attributes = {
    pkg: require(cwd+'/package.json')
};

module.exports = plugin;
