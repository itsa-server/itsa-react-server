'use strict';

const reload = require('require-reload')(require), // see https://github.com/fastest963/require-reload
    cwd = process.cwd(),
    generateServiceWorker = require('../..//serviceworker/generate-serviceworker'),
    OFFLINE_IMAGE = require('../../offline-image'),
    OFFLINE_PAGE = '/offline/',
    COOKIE_DEFS = {
        bodyDataAttr: 'getBodyDataAttrCookie',
        props: 'getPropsCookie',
        notExposed: 'getNotExposedCookie'
    },
    EXPIRE_ONE_YEAR = 365 * 24 * 60 * 60 * 1000,
    EXPIRE_TEN_YEARS = 10 * EXPIRE_ONE_YEAR;

const generate = async (server, urlsToCache, appConfig, startupTime) => {
    const prefix = '/build',
        cwdPrefix = cwd+prefix,
        serverConnection = server.root,
        favicon = (appConfig.cdn || cwdPrefix+'/public/') + 'assets/' + appConfig.packageVersion + '/favicon.ico',
        routes = reload(cwd+'/src/routes.js');

    serverConnection.activateRoutes = function() {
        var startRouting = setTimeout(function() {
            console.error('Error: failied to load routes');
        }, 5000);
        try {
            serverConnection.route(routes);
        }
        catch (err) {
            console.warn(err);
        }
        clearTimeout(startRouting);

        serverConnection.routes = {
            prefix: prefix
        };
    };

    routes.push({
        method: 'GET',
        path: '/favicon.ico',
        handler: function(request, reply) {
            if (appConfig.cdn) {
                reply().redirect(favicon).permanent().rewritable();
            }
            else {
                reply.file(favicon);
            }
        },
        config: {
            cache: {
                expiresIn: EXPIRE_ONE_YEAR
            }
        }
    });

    // assets created with `require` follow with as deep nested as needed, they also have a version in the url:
    routes.push({
        method: 'GET',
        path: '/assets/'+appConfig.packageVersion+'/{filename*}',
        handler: function(request, reply) {
            // inert will set an eTag. We leave `no-cache` because the file might change while the name keeps the same.
            reply.file(cwdPrefix+'/public/assets/'+appConfig.packageVersion+'/'+request.params.filename);
        },
        config: {
            cache: {
                expiresIn: EXPIRE_ONE_YEAR
            }
        }
    });

    // assets created with `require` follow with as deep nested as needed, they also have a version in the url:
    routes.push({
        method: 'GET',
        path: '/assets-private/'+appConfig.packageVersion+'/{filename*}',
        handler: function(request, reply) {
            // inert will set an eTag. We leave `no-cache` because the file might change while the name keeps the same.
            reply.file(cwdPrefix+'/private/assets-private/'+appConfig.packageVersion+'/'+request.params.filename);
        },
        config: {
            cache: {
                expiresIn: EXPIRE_ONE_YEAR
            }
        }
    });

    // external modules, created by webpack
    routes.push({
        method: 'GET',
        path: '/assets/_itsa_server_external_modules/{versionedmodule*}',
        handler: function(request, reply) {
            reply.file(cwdPrefix+'/public/assets/_itsa_server_external_modules/'+request.params.versionedmodule);
        },
        config: {
            cache: {
                expiresIn: EXPIRE_TEN_YEARS
            }
        }
    });

    routes.push({
        method: 'GET',
        path: '/assets/local/{filename*}',
        handler: function(request, reply) {
            // inert will set an eTag. We leave `no-cache` because the file might change while the name keeps the same.
            reply.file(cwdPrefix+'/private/assets/'+request.params.filename);
        },
        config: {
            cache: {
                expiresIn: EXPIRE_ONE_YEAR
            }
        }
    });

    routes.push({
        method: 'GET',
        path: '/assets/{filename*}',
        handler: function(request, reply) {
            // inert will set an eTag. We leave `no-cache` because the file might change while the name keeps the same.
            reply.file(cwdPrefix+'/public/assets/'+appConfig.packageVersion+'/'+request.params.filename);
        },
        config: {
            cache: {
                expiresIn: EXPIRE_ONE_YEAR
            }
        }
    });

    if (appConfig['service-workers']) {
        routes.push({
            method: 'GET',
            path: '/_itsa_server_serviceworker.js',
            handler: function(request, reply) {
                // inert will set an eTag. We leave `no-cache` because the file might change while the name keeps the same.
                generateServiceWorker.generateFile(startupTime, urlsToCache, OFFLINE_IMAGE, OFFLINE_PAGE, appConfig.socketPort || 4002, appConfig.cdn)
                    .then(fileContent => reply(fileContent).type('application/javascript; charset=utf-8').header('Cache-Control', 'no-cache, no-store, must-revalidate'))
                    .catch(err => {
                        console.warn(err);
                        reply(err);
                    });
            }
        });
    }

    serverConnection.activateRoutes();
};

module.exports = {
    generate
};
