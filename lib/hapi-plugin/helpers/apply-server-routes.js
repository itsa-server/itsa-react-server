/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

const reload = require('require-reload')(require), // see https://github.com/fastest963/require-reload
    cwd = process.cwd(),
    generateServiceWorker = require('../..//serviceworker/generate-serviceworker'),
    OFFLINE_IMAGE = require('../../offline-image'),
    OFFLINE_PAGE = '/offline/',
    EXPIRE_ONE_YEAR = 365 * 24 * 60 * 60 * 1000,
    EXPIRE_TEN_YEARS = 10 * EXPIRE_ONE_YEAR;

const generate = async (server, urlsToCache, appConfig, startupTime) => {
    const prefix = '/build',
        cwdPrefix = cwd+prefix,
        serverConnection = server,
        favicon = ((appConfig.cdn && appConfig.cdn.enabled) ? appConfig.cdn.url : cwdPrefix+'/public/') + 'assets/' + appConfig.packageVersion + '/favicon.ico',
        routes = reload(cwd+'/src/routes.js');

    if (appConfig.pageNotFoundView) {
        server.ext('onPreResponse', function(request, h) {
            // manage mismatches based upon the `scope`:
            const response = request.response;
            let uri, isHtmlPage;
            if (response.isBoom && response.output && (response.output.statusCode===404)) {
                // if request to a page, then redirect:
                uri = request.url.pathname.toUpperCase();
                isHtmlPage = uri.endsWith('.HTML') || uri.endsWith('.HTM') || (uri.lastIndexOf('.')<uri.lastIndexOf('/'));
                if (isHtmlPage) {
                    return h.reactview(appConfig.pageNotFoundView);
                }
            }
            return h.continue;
        });
    }

    routes.push({
        method: 'GET',
        path: '/favicon.ico',
        handler: function(request, h) {
            if (appConfig.cdn && appConfig.cdn.enabled) {
                return h.redirect(favicon).permanent().rewritable();
            }
            return h.file(favicon);
        },
        options: {
            cache: {
                expiresIn: EXPIRE_ONE_YEAR,
                privacy: 'private'
            }
        }
    });

    // All asset routes pass `confine`: an encoded `..%2F` inside the filename would otherwise escape the
    // directory and serve any file of the app (like .cookierc). A confined miss answers 403.

    // assets created with `require` follow with as deep nested as needed, they also have a version in the url:
    routes.push({
        method: 'GET',
        path: '/assets/'+appConfig.packageVersion+'/{filename*}',
        handler: function(request, h) {
            // inert will set an eTag. We leave `no-cache` because the file might change while the name keeps the same.
            return h.file(request.params.filename, {confine: cwdPrefix+'/public/assets/'+appConfig.packageVersion});
        },
        options: {
            cache: {
                expiresIn: EXPIRE_ONE_YEAR,
                privacy: 'private'
            }
        }
    });

    // assets created with `require` follow with as deep nested as needed, they also have a version in the url:
    routes.push({
        method: 'GET',
        path: '/assets-private/'+appConfig.packageVersion+'/{filename*}',
        handler: function(request, h) {
            // inert will set an eTag. We leave `no-cache` because the file might change while the name keeps the same.
            return h.file(request.params.filename, {confine: cwdPrefix+'/private/assets-private/'+appConfig.packageVersion});
        },
        options: {
            cache: {
                expiresIn: EXPIRE_ONE_YEAR,
                privacy: 'private'
            }
        }
    });

    // external modules, created by webpack
    routes.push({
        method: 'GET',
        path: '/assets/_itsa_server_external_modules/{versionedmodule*}',
        handler: function(request, h) {
            return h.file(request.params.versionedmodule, {confine: cwdPrefix+'/public/assets/_itsa_server_external_modules'});
        },
        options: {
            cache: {
                expiresIn: EXPIRE_TEN_YEARS,
                privacy: 'private'
            }
        }
    });

    routes.push({
        method: 'GET',
        path: '/assets/local/{filename*}',
        handler: function(request, h) {
            // inert will set an eTag. We leave `no-cache` because the file might change while the name keeps the same.
            return h.file(request.params.filename, {confine: cwdPrefix+'/private/assets'});
        },
        options: {
            cache: {
                expiresIn: EXPIRE_ONE_YEAR,
                privacy: 'private'
            }
        }
    });

    routes.push({
        method: 'GET',
        path: '/assets/{filename*}',
        handler: function(request, h) {
            // inert will set an eTag. We leave `no-cache` because the file might change while the name keeps the same.
            return h.file(request.params.filename, {confine: cwdPrefix+'/public/assets/'+appConfig.packageVersion});
        },
        options: {
            cache: {
                expiresIn: EXPIRE_ONE_YEAR,
                privacy: 'private'
            }
        }
    });

    routes.push({
        method: 'GET',
        path: '/_itsa_server_serviceworker.js',
        handler: async function(request, h) {
            let fileContent;
            if (appConfig['service-workers'] && appConfig['service-workers'].enabled) {
                try {
                    fileContent = await generateServiceWorker.generateFile(startupTime, urlsToCache, OFFLINE_IMAGE, OFFLINE_PAGE, appConfig.socketPort || 4002,
                        (appConfig.cdn && appConfig.cdn.enabled) ? appConfig.cdn.url : null);
                }
                catch (err) {
                    console.warn(err);
                    throw err;
                }
                return h.response(fileContent).type('application/javascript; charset=utf-8').header('Cache-Control', 'no-cache, no-store, must-revalidate');
            }
            return h.response('').type('application/javascript; charset=utf-8').header('Cache-Control', 'no-cache, no-store, must-revalidate');
        },
        options: {
            response: {
                // hapi 21 answers an empty payload with 204; the (disabled) service worker keeps its 200
                emptyStatusCode: 200
            }
        }
    });

    serverConnection.route(routes);
};

module.exports = {
    generate
};
