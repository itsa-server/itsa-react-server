/* eslint no-empty: 0*/
'use strict';

const reload = require('require-reload')(require), // see https://github.com/fastest963/require-reload
    routesPath = process.cwd()+'/src/routes.js';

const generate = async (clientRoutes, viewComponentNrs, appTitles, serviceWorkerCacheListViews, appConfig) => {
    const routes = reload(routesPath);

    const fakereply = {
        reactview: function(view) {
            this.view = view;
        }
    };
    const getRouteReactView = route => {
        let subMethodGet, handler;
        if (Array.isArray(route.method)) {
            subMethodGet = route.method.find(method => (method.toUpperCase()==='GET'));
            route.method = subMethodGet ? 'GET' : 'UNDEFINED';
        }
        if (route.method.toUpperCase()!=='GET') {
            return;
        }
        if (typeof route.handler==='function') {
            handler = route.handler;
        }
        else {
            if (route.config && (typeof route.config.handler==='function')) {
                handler = route.config.handler;
            }
            else {
                return;
            }
        }
        // now fake the handler. If an error occurs, then there is no valid reactview-route
        delete fakereply.view;
        try {
            handler({params:{}, query: {}, payload: {}}, fakereply);
            return {
                view: fakereply.view
            };
        }
        catch (err) {}
    };

    routes.forEach(function(route) {
        let affinityCompNr, affinityTitles, compHash;
        const routeReactView = getRouteReactView(route);
        if (routeReactView) {
            affinityCompNr = viewComponentNrs[routeReactView.view];
            // only at the start: check if this serverroute is valid
            if (affinityCompNr) {
                compHash = affinityCompNr.hash;
                // when no auth, the store it as a route that should be available for serviceworkers:
                if (!route.config || !route.config.auth) {
                    // push the landingpage:
                    serviceWorkerCacheListViews.push(route.path);
                    // push the ajax component:
                    serviceWorkerCacheListViews.push('/_itsa_server_ajax_/comp/'+compHash+route.path);
                    // push the ajax css:
                    serviceWorkerCacheListViews.push('/_itsa_server_ajax_/css/'+compHash+route.path);
                    // push the ajax props:
                    serviceWorkerCacheListViews.push('/_itsa_server_ajax_/props/'+compHash+route.path);
                }
                affinityTitles = appTitles[routeReactView.view];
                clientRoutes.desktop.push({
                    path: route.path,
                    view: routeReactView.view,
                    title: affinityTitles,
                    componentId: affinityCompNr.componentId,
                    routeHash: affinityCompNr.hash,
                    requireId: affinityCompNr.requireId
                });
                affinityCompNr = viewComponentNrs[routeReactView.view+'@tablet'] || affinityCompNr;
                affinityTitles = appTitles[routeReactView.view+'@tablet'] || affinityTitles;
                clientRoutes.tablet.push({
                    path: route.path,
                    view: routeReactView.view,
                    title: affinityTitles,
                    componentId: affinityCompNr.componentId,
                    routeHash: affinityCompNr.hash,
                    requireId: affinityCompNr.requireId
                });
                affinityCompNr = viewComponentNrs[routeReactView.view+'@phone'] || affinityCompNr;
                affinityTitles = appTitles[routeReactView.view+'@phone'] || affinityTitles;
                clientRoutes.phone.push({
                    path: route.path,
                    view: routeReactView.view,
                    title: affinityTitles,
                    componentId: affinityCompNr.componentId,
                    routeHash: affinityCompNr.hash,
                    requireId: affinityCompNr.requireId
                });
            }
        }
    });
};

module.exports = {
    generate
};
