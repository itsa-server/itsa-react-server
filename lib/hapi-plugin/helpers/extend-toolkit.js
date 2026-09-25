/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

require('itsa-jsext');

const ItsaJsxView = require('./jsx-view'),
    cwd = process.cwd(),
    Path = require('path'),
    fs = require('fs-extra'),
    actionHandler = require('./action-handler'),
    assetsHandler = require('./assets-handler'),
    modelHandler = require('./model-handler'),
    getAffinityView = require('./affinity-view'),
    buildProps = require('./build-props'),
    cachedFileContent = require('./cached-file-content'),
    authenticationHandler = require('../authentication/authentication-handler'),
    cookieHandler = require('../cookies/cookie-handler'),
    applyDataCookie = require('./apply-data-cookie'),
    changeCookies = require('./change-cookies'),
    refreshCookies = require('./refresh-cookies'),
    cookiePasswords = require(cwd+'/.cookierc'),
    ATTACK_SAFE_JSON = 'for(;;);', // see https://stackoverflow.com/questions/2669690/why-does-google-prepend-while1-to-their-json-responses
    FILE404 = 'file404.html',
    SECONDS_PER_DAY = 60 * 60 * 24,
    EXPIRE_ONE_YEAR = 365 * SECONDS_PER_DAY * 1000,
    MSG_SUB_ROUTE = {
        'props': '(ajax request for this.props)',
        'comp': '(ajax request for the Component)',
        'css': '(ajax request for the CSS)',
    };

let DEFINED_VIEWS = {};

const extend = async (server, options, appConfig, viewComponentCommon, viewComponentNrs, appTitles, clientRoutes, startupTime) => {
    const buildPrefix = '/build/',
        extraEngines = options.engines;
    let views;

    views = {
        defaultExtension: 'js',
        engines: {
            js: ItsaJsxView.View // support for .js
        },
        relativeTo: cwd+buildPrefix,
        path: 'view_components'
    };

    /*
       adding custom engines, when defined inside server.js
       by means of:
          ReactServerPlugin.options.engines: {
              ejs: require('ejs')
          };
    */
    if (Object.itsa_isObject(extraEngines)) {
        views.engines.itsa_merge(extraEngines);
    }

    server.views(views);

    // Extend with authentication:
    if (appConfig['app-authentication'] && appConfig['app-authentication'].enabled) {
        try {
            await authenticationHandler.register(server, appConfig['app-authentication'], cookiePasswords['app-authentication']);
        }
        catch (err) {
            console.error(err);
        }
    }

    // Extend with cookies:
    if (Object.itsa_isObject(appConfig.cookies)) {
        cookieHandler.register(server, appConfig.cookies['body-data-attr'], appConfig.cookies['not-exposed'], appConfig.cookies.props, appConfig.cookies.globalstate, cookiePasswords);
    }

    // builds `this.props` for a view; shared by h.reactview() and h.generateProps()
    const createProps = async (request, h, view, routeOptions, affinityView, mergeAssets, noAuthentication) => {
        const config = {};
        let props, globalstateConfig, initialGlobalStateFn, initialGlobalState, generalModelFn, generalModel,
            bodyDataAttr, replaceObject, isStringMessage, offLineMsgField;

        props = buildProps.generate(request, view, appTitles, config, appConfig, clientRoutes, startupTime);
        props.authentication = !noAuthentication;
        if (routeOptions && routeOptions.__authenticationMsg__) {
            props.authenticationMsg = routeOptions.__authenticationMsg__;
        }

        if (mergeAssets) {
            // merge the asssets into props:
            await assetsHandler.merge(props, affinityView, viewComponentCommon, viewComponentNrs, appConfig);
        }

        // apply initial state:
        globalstateConfig = appConfig.cookies && appConfig.cookies.globalstate;
        if (globalstateConfig && globalstateConfig.enabled) {
            props.__appProps.globalStateDef = {
                secure: !!globalstateConfig.onlySsl,
                'limited-props': globalstateConfig['limited-props'] || []
            };
            if (globalstateConfig['ttl-sec']) {
                props.__appProps.globalStateDef.expires = globalstateConfig['ttl-sec']*SECONDS_PER_DAY; // expires is in days from now
            }
            try {
                props.__appProps.initialGlobalState = {};
                initialGlobalStateFn = require(cwd+'/src/initial-globalstate.js');
                initialGlobalState = await initialGlobalStateFn(request, h, routeOptions, props.__appProps.lang, appConfig);
                // merge the initial globalstate into props.__appProps.initialGlobalState:
                if (Object.itsa_isObject(initialGlobalState)) {
                    props.__appProps.initialGlobalState.itsa_merge(initialGlobalState);
                }
            }
            catch (err) {
                console.error(err);
            }
        }

        // aply the general model:
        try {
            generalModelFn = require(cwd+'/src/model-general.js');
            generalModel = await generalModelFn(request, h, routeOptions, props.__appProps.lang, appConfig);
            // merge the geberal model into props:
            if (Object.itsa_isObject(generalModel)) {
                props.itsa_merge(generalModel);
            }
        }
        catch (err) {
            console.error(err);
        }

        // merge view-model:
        await modelHandler.merge(request, h, props, routeOptions, appConfig, view);

        // generate props.__bodyDataAttr, based upon the values in the `itsa-bodydata`-cookie
        if (appConfig.cookies && appConfig.cookies['body-data-attr'] && appConfig.cookies['body-data-attr'].enabled) {
            await applyDataCookie.merge(request, props);
        }
        // if h.setBodyDataAttr() is called, then merge the data:
        bodyDataAttr = request.app._itsa_bodyDataAttr;
        if (bodyDataAttr) {
            bodyDataAttr.itsa_each((value, key) => {
                props.__bodyDataAttr[((key.itsa_startsWith('data-', true)) ? key : 'data-'+key).toLowerCase()] = (typeof value==='string') ? value : JSON.stringify(value);
            });
        }

        // only now, we can add the offline message:
        if (props.__appProps.showOffline) {
            replaceObject = {};
            isStringMessage = (typeof props.__appProps.showOffline==='string');
            if (isStringMessage) {
                offLineMsgField = props.__appProps.showOffline.substring(1, props.__appProps.showOffline.length-1);
                if (offLineMsgField) {
                    replaceObject[offLineMsgField] = props[offLineMsgField]!==undefined ? props[offLineMsgField] : props.__appProps.showOffline;
                }
            }
            props.__appProps.offlineMessage = {__html: isStringMessage ? props.__appProps.showOffline.itsa_substitute(replaceObject) : 'OFFLINE'};
        }
        return props;
    };

    // Decorate `h` with the method `setBodyDataAttr`
    // stored on request.app: hapi 21 gives every lifecycle step its own `h`
    server.decorate('toolkit', 'setBodyDataAttr', function(props) {
        const request = this.request;
        if (Object.itsa_isObject(props)) {
            request.app['_itsa_bodyDataAttr'] = props.itsa_deepClone();
        }
    });

    // DO NOT use arrowfunction here: we need the former context
    server.decorate('toolkit', 'action', function(action, options) {
        const h = this;
        return actionHandler.invoke(action, options, h.request, h, appConfig);
    });

    // DO NOT use arrowfunction here: we need the former context
    server.decorate('toolkit', 'assets', function(filename) {
        const prefix = cwd+buildPrefix+'public/assets/'+appConfig.packageVersion+'/';
        return this.file(Path.join(prefix, filename));
    });

    // DO NOT use arrowfunction here: we need the former context
    server.decorate('toolkit', 'generateProps', async function(view, routeOptions) {
        const h = this;
        let props;
        try {
            props = await createProps(h.request, h, view, routeOptions || {}, undefined, true, false);
        }
        catch (err) {
            console.warn(err);
        }
        return props;
    });

    // DO NOT use arrowfunction here: we need the former context
    server.decorate('toolkit', 'reactview', async function(view, routeOptions) { // NO ARROW FUNCTION --> we need `this` as it is set (===h)
        const h = this,
            request = h.request;
        let props, affinityView, data, ajaxProperties, ajaxComp, ajaxCss, sendRequireId, file404, noAuthentication, debugIntro;

        const withNoAuth = response => {
            if (noAuthentication) {
                response.header('x-noauth', 'true');
            }
            return response;
        };

        try {
            ajaxProperties = (request.headers['x-ajaxtype']==='props');
            ajaxComp = (request.headers['x-ajaxtype']==='comp');
            ajaxCss = (request.headers['x-ajaxtype']==='css');
            if (appConfig.debug) { // to prevent as less load as possible, we check for `appConfig.debug` --> console.debug does this check also by itself
                if (request.headers['x-itsa-serviceworker-init']==='true') {
                    debugIntro = 'Responding serviceworker pre cache for view:';
                }
                else {
                    debugIntro = 'Responding server route for view:';
                }
                console.debug(request, debugIntro, '"'+view+'"', MSG_SUB_ROUTE[request.headers['x-ajaxtype']] || '(full page)');
            }

            // look if  we need to set __sendRequireId__:
            sendRequireId = !!(routeOptions && routeOptions.__sendRequireId__);
            noAuthentication = !!(routeOptions && !!routeOptions.__noAuth__);

            if (ajaxProperties) {
                // check if we need to change any cookies that may have been send with the payload:
                changeCookies.generate(request, h);
            }

            // set modelcontext and assetscontext for usage inside templates:
            affinityView = await getAffinityView.generate(view, request.affinity);

            // build `this.props`:
            if (!ajaxComp && !ajaxCss) {
                props = await createProps(request, h, view, routeOptions, affinityView, !ajaxProperties, noAuthentication);
            }

            // reply differently for ajax-requests:
            if (ajaxComp) {
                if (!viewComponentNrs[affinityView]) {
                    return h.response('file not found').code(404);
                }
                data = await cachedFileContent.readFile(cwd+buildPrefix+'private/assets/js/'+viewComponentNrs[affinityView].hash+'.js', 'utf8');
                if (sendRequireId) {
                    // find the right sendRequireId for this view, for the view had been changed
                    // probably by the module itsa-authentication
                    data = 'window.itsa_requireId=' + viewComponentNrs[affinityView].requireId + ';' + data;
                }
                // reply with attack-safe json --> will be removed at the client
                return withNoAuth(h.response(ATTACK_SAFE_JSON+data).ttl(EXPIRE_ONE_YEAR).etag(viewComponentNrs[affinityView].hash));
            }
            if (ajaxCss) {
                if (!viewComponentNrs[affinityView]) {
                    return h.response('file not found').code(404);
                }
                data = await cachedFileContent.readFile(cwd+buildPrefix+'private/assets/css/'+viewComponentNrs[affinityView].cssfile, 'utf8');
                return withNoAuth(h.response(data).ttl(EXPIRE_ONE_YEAR).etag(viewComponentNrs[affinityView].cssfile));
            }
            if (ajaxProperties) {
                // refresh the ttl of the cookies
                refreshCookies.refresh(request, h, appConfig);
                return withNoAuth(h.response(props));
            }
            if (DEFINED_VIEWS[affinityView]===true) {
                // refresh the ttl of the cookies
                refreshCookies.refresh(request, h, appConfig);
                return withNoAuth(h.view(affinityView, props));
            }
            if (DEFINED_VIEWS[affinityView]===undefined) {
                try {
                    await fs.stat(cwd+'/build/view_components/'+affinityView+'.js');
                    DEFINED_VIEWS[affinityView] = true;
                }
                catch (err) {
                    DEFINED_VIEWS[affinityView] = false;
                }
                if (DEFINED_VIEWS[affinityView]) {
                    // the first request for a view does not refresh the cookie ttl (as in 17.x)
                    return withNoAuth(h.view(affinityView, props));
                }
            }
            file404 = cwd+'/src/'+FILE404;
            try {
                await fs.stat(file404);
            }
            catch (err) {
                return h.response().code(404);
            }
            return h.file(file404).code(404);
        }
        catch (err) {
            console.warn(err);
            throw err;
        }
    });
};

module.exports = {
    extend
};
