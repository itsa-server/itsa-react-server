/* eslint no-console: 0*/
'use strict';

// see: Https://www.smashingmagazine.com/2016/02/making-a-service-worker/
// DON'T use ES6 code --> this file is `uglified` on the fly and (as now) needs to be ES5

(function(/* serviceworker, version, urlsToCache, offlineImage, offlinePage, socketPort, cdn */) {
    // CAUTIOUS: uglify seems to MESS with unused arguments assigned to `config` --> see after uglifying!
    // therefore, we use the values of the arguments:
    var args = arguments,
        serviceworker = args[0],
        config = {
            cacheName: 'itsa-react-server-cache-'+args[1],
            version: args[1],
            urlsToCache: args[2],
            offlineImage: args[3],
            offlinePage: args[4],
            cdn: args[5],
            socketPort: args[6]
        };

    var addToCache = function(cacheKey, request, response) {
        var copy;
        if (!response.ok) {
            throw new Error('bad response');
        }
        copy = response.clone();
        caches.open(cacheKey).then(function(cache) {
            var url = new URL(request.url),
                ajaxProps = url.pathname.startsWith('/_itsa_server_ajax_\/props/'),
                indexQuestionmark, newRequest;
            if (ajaxProps) {
                // switch the questionmark-timestamp
                // because, in the cache, there is a version a timestamp set at the server's startuptime
                indexQuestionmark = request.url.indexOf('?');
                if (indexQuestionmark!==-1) {
                    // need to change the url, but this is a read-only prop
                    // we do not want to request.clone(); because that will lead into read-only once again
                    newRequest = new Request(request.url.substring(0, indexQuestionmark));
                }
            }
            console.info('add to cache:', (newRequest || request).url);
            cache.put(newRequest || request, copy);
        });
        return response;
    };

    serviceworker.addEventListener('install', function(event) {
        var cacheAllWithCustomHeader = function(cacheKey, urlsToCache) {
            var list = urlsToCache.map(function(url) {
                var request = new Request(url, {headers: new Headers({'x-itsa-serviceworker-init': 'true'})});
                // TODO: unfortunately, serviceworkers cannot access httponly cookies. Therefore, we will miss its value during pre-catch..
                // the good thing is however, that during navigation, the props-requests will have the cookie values merged into this.props
                // so, it is very unlikely to face any issues
                return fetch(request).then(addToCache.bind(null, cacheKey, request));
            });
            return Promise.all(list);
        };
        var onInstall = function(opts) {
            return cacheAllWithCustomHeader(opts.cacheName, opts.urlsToCache)
                .then(function() {
                    console.info(opts.cacheName, 'serviceworker installed with version', args[1]);
                    return self.skipWaiting();
                })
                .catch(function(err) {
                    console.error(opts.cacheName, 'error installing serviceworker:', err);
                });
        };
        // Perform install steps
        event.waitUntil(onInstall(config));
    });

    serviceworker.addEventListener('fetch', function(event) {
        var shouldHandleFetch = function(event, opts) {
            var request = event.request || {},
                url = new URL(request.url),
                xCookieHeader = request.headers.get('x-cookie'),
                criteria = {
                    matchesPathPattern: (url.pathname!=='/_itsa_server_serviceworker.js'),
                    isGETRequest: (request.method==='GET'),
                    isFromMyOrigin: (url.origin===serviceworker.location.origin) || url.origin.startsWith(opts.cdn),
                    isNotSocketServer: (url.port!==opts.socketPort),
                    isNotPropsRequestWithCookie: (!url.pathname.startsWith('/_itsa_server_ajax_/props/') || !xCookieHeader),
                    isPartOfList: (opts.urlsToCache.indexOf(url.pathname)!==-1)
                };
            // search for an item that is `false` --> if present, then SHOULD NOT FETCH, because all items should be `true` in order to fetch
            console.warn('shouldHandleFetch', url.pathname, '-->', !Object.keys(criteria).some(function(criteriaKey) {
                return !criteria[criteriaKey];
            }));
            return !Object.keys(criteria).some(function(criteriaKey) {
                return !criteria[criteriaKey];
            });
        };

        var shouldReloadIntoCache = function(request) {
            var url = new URL(request.url),
                pathname = url.pathname,
                nonCacheList = {
                    staticExternalModules: (pathname.startsWith('/assets/_itsa_server_external_modules/')),
                    staticJsAndCss: (pathname.startsWith('/assets/local')),
                    staticCommonsJsAndView: (/\/assets\/\d+\.\d+\.\d+\/_itsa_server_commons\//).test(pathname),
                    ajaxStatic: pathname.startsWith('/_itsa_server_ajax_/css/') || pathname.startsWith('/_itsa_server_ajax_/comp/'),
                    hasTimeStamp: (/[&|?]_ts=(\d){13}/).test(url.search)
                };
            console.warn('shouldReloadIntoCache', url.pathname, '-->', !Object.keys(nonCacheList).some(function(criteriaKey) {
                return nonCacheList[criteriaKey];
            }));
            // search for the first item in the nonCacheableList --> if found, than DO NOT RELOAD into cache
            return !Object.keys(nonCacheList).some(function(criteriaKey) {
                return nonCacheList[criteriaKey];
            });
        };

        var fetchFromCache = function(request) {
            var url = new URL(request.url),
                ajaxProps = url.pathname.startsWith('/_itsa_server_ajax_\/props/'),
                indexQuestionmark, newRequest;
            console.info('try to fetchFromCache', request.url);
            if (ajaxProps) {
                // switch the questionmark-timestamp
                // because, in the cache, there is a version a timestamp set at the server's startuptime
                indexQuestionmark = request.url.indexOf('?');
                if (indexQuestionmark!==-1) {
                    // need to change the url, but this is a read-only prop
                    // we do not want to request.clone(); because that will lead into read-only once again
                    newRequest = new Request(request.url.substring(0, indexQuestionmark));
                }
            }
            return caches.match(newRequest || request).then(function(response) {
                if (!response) {
                    // A synchronous error that will kick off the catch handler
                    throw Error((newRequest || request).url+' not found in cache');
                }
                console.info('fetch from cache: ', (newRequest || request).url);
                return response;
            });
        };

        var offlineResponse = function(resourceType, opts) {
            if (resourceType === 'image') {
                return new Response(opts.offlineImage, {headers: {'Content-Type': 'image/svg+xml'}});
            }
            else if (resourceType === 'content') {
                return caches.match(opts.offlinePage);
            }
            // else return undefined;
        };

        var respondNetworkFirst = function(request, resourceType, cacheKey, opts) {
            console.info('respondNetworkFirst', request.url);
            return fetch(request).then(addToCache.bind(null, cacheKey, request))
                .catch(function() {
                    return fetchFromCache(request, opts);
                })
                .catch(function() {
                    return offlineResponse(resourceType, opts);
                });
        };

        var respondCacheFirst = function(request, resourceType, cacheKey, opts) {
            console.info('respondCacheFirst', request.url);
            return fetchFromCache(request, opts).then(
                function(response) {
                    console.info('found from cache', request.url);
                    if (shouldReloadIntoCache(request)) {
                        console.info('reload into cache');
                        // DO NOT RETURN the next promise --> we don't want to wait for this step!
                        fetch(request).then(function(response) {
                            return addToCache(cacheKey, request, response);
                        });
                    }
                    return response;
                },
                function() {
                    // try to load the request from the server
                    return fetch(request).then(function(response) {
                        return addToCache(cacheKey, request, response);
                    });
                })
                .catch(function() {
                    return offlineResponse(resourceType, opts);
                });
        };

        var onFetch = function(event, opts) {
            var request = event.request,
                resourceType = 'static',
                acceptHeader = request.headers.get('Accept'),
                url = new URL(request.url),
                ajaxStatics = url.pathname.startsWith('/_itsa_server_ajax_/css/') || url.pathname.startsWith('/_itsa_server_ajax_/comp/'),
                ajaxProps = url.pathname.startsWith('/_itsa_server_ajax_/props/'),
                cacheKey = opts.cacheName,
                networkFirst;
            if (acceptHeader.indexOf('text/html')!==-1) {
                resourceType = 'content';
            }
            else if (acceptHeader.indexOf('image')!==-1) {
                resourceType = 'image';
            }
            networkFirst = ((resourceType==='content') && !ajaxStatics) || ajaxProps;
            if (networkFirst) {
                // Use a network-first strategy.
                event.respondWith(respondNetworkFirst(request, resourceType, cacheKey, opts));
            }
            else {
                // Use a cache-first strategy.
                event.respondWith(respondCacheFirst(request, resourceType, cacheKey, opts));
            }
        };

        if (shouldHandleFetch(event, config)) {
            onFetch(event, config);
        }
    });

    serviceworker.addEventListener('activate', function(event) {
        var onActivate = function(event, opts) {
            console.info('activate serviceworker');
            return caches.keys().then(function(cacheKeys) {
                var deletePromises = cacheKeys.filter(function(key) {
                    return (key!==opts.cacheName);
                }).map(function(oldKey) {
                    console.info('deleting serviceworker with version', oldKey);
                    return caches.delete(oldKey);
                });
                return Promise.all(deletePromises);
            });
        };

        event.waitUntil(
            onActivate(event, config).then(function() {
                return serviceworker.clients.claim();
            })
        );
    });

}(autoparams)); // autoparams will be set by itsa-react-server during runtime
