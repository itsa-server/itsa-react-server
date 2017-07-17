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
    EXPIRE_ONE_YEAR = 365 * 24 * 60 * 60 * 1000,
    MSG_SUB_ROUTE = {
        'props': '(ajax request for this.props)',
        'comp': '(ajax request for the Component)',
        'css': '(ajax request for the CSS)',
    };

let DEFINED_VIEWS = {};

const extend = async (server, options, appConfig, viewComponentCommon, viewComponentNrs, appTitles, clientRoutes, startupTime) => {
    const buildPrefix = '/build/',
        serverConnection = server.root,
        extraEngines = options.engines;
    let views;

    serverConnection.connection({
        host: 'localhost',
        port: appConfig.port
    });

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

    serverConnection.views(views);

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
        cookieHandler.register(server, appConfig.cookies['body-data-attr'], appConfig.cookies['not-exposed'], appConfig.cookies.props, cookiePasswords);
    }

    // Decorate `reply` with the method `setBodyDataAttr`
    server.decorate('reply', 'setBodyDataAttr', function(props) {
        const reply = this;
        if (Object.itsa_isObject(props)) {
            reply['_itsa_bodyDataAttr'] = props.itsa_deepClone();
        }
    });

    // DO NOT use arrowfunction here: we need the former context
    server.decorate('reply', 'action', function(action, options) {
        const reply = this,
            request = reply.request;
        actionHandler.invoke(action, options, request, reply, appConfig);
    });

    // DO NOT use arrowfunction here: we need the former context
    server.decorate('reply', 'assets', function(filename) {
        let prefix = cwd+buildPrefix+'public/assets/'+appConfig.packageVersion+'/',
            reply = this;
        reply.file(Path.join(prefix, filename));
    });

    // DO NOT use arrowfunction here: we need the former context
    server.decorate('reply', 'reactview', async function(view, routeOptions) { // NO ARROW FUNCTION --> we need `this` as it is set (===reply)
        const reply = this,
            request = reply.request;
        let config={},
            props, affinityView, data, ajaxProperties, ajaxComp, ajaxCss, sendRequireId, file404, generalModelFn,
            generalModel, replaceObject, isStringMessage, offLineMsgField, noAuthentication, debugIntro;

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
            // ES6 destructering not working yet??

            // look if  we need to set __sendRequireId__:
            sendRequireId = !!(routeOptions && routeOptions.__sendRequireId__);
            noAuthentication = !!(routeOptions && !!routeOptions.__noAuth__);

            if (ajaxProperties) {
                // check if we need to change any cookies that may have been send with the payload:
                changeCookies.generate(request, reply);
            }

            // set modelcontext and assetscontext for usage inside templates:
            affinityView = await getAffinityView.generate(view, request.affinity);

            // build `this.props`:
            if (!ajaxComp && !ajaxCss) {
                // initialise props:
                props = buildProps.generate(request, view, appTitles, config, appConfig, clientRoutes, startupTime);
                props.authentication = !noAuthentication;
                if (routeOptions && routeOptions.__authenticationMsg__) {
                    props.authenticationMsg = routeOptions.__authenticationMsg__;
                }

                if (!ajaxProperties) {
                    // merge the asssets into props:
                    await assetsHandler.merge(props, affinityView, viewComponentCommon, viewComponentNrs, appConfig);
                }

                // aply the general model:
                try {
                    generalModelFn = require(cwd+'/src/model-general.js');
                    generalModel = await generalModelFn(request, reply, routeOptions, props.__appProps.lang, appConfig);
                    // merge the geberal model into props:
                    if (Object.itsa_isObject(generalModel)) {
                        // props.itsa_merge(generalModel, {force: 'deep'});
                        props.itsa_merge(generalModel);
                    }
                }
                catch (err) {
                    console.error(err);
                }

                // merge view-model:
                await modelHandler.merge(request, reply, props, routeOptions, appConfig, view);

                // generate props.__bodyDataAttr, based upon the values in the `itsa-bodydata`-cookie
                if (appConfig.cookies && appConfig.cookies['body-data-attr'] && appConfig.cookies['body-data-attr'].enabled) {
                    await applyDataCookie.merge(request, props);
                }
                // if reply.setBodyDataAttr() is called, then merge the data:
                if (reply._itsa_bodyDataAttr) {
                    reply['_itsa_bodyDataAttr'].itsa_each((value, key) => {
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
            }

            // reply differently for ajax-requests:
            if (ajaxComp) {
                if (!viewComponentNrs[affinityView]) {
                    return reply('file not found').code(404);
                }
                data = await cachedFileContent.readFile(cwd+buildPrefix+'private/assets/js/'+viewComponentNrs[affinityView].hash+'.js', 'utf8');
                if (sendRequireId) {
                    // find the right sendRequireId for this view, for the view had been changed
                    // probably by the module itsa-authentication
                    data = 'window.itsa_requireId=' + viewComponentNrs[affinityView].requireId + ';' + data;
                }
                // reply with attack-safe json --> will be removed at the client
                // see: https://stackoverflow.com/questions/2669690/why-does-google-prepend-while1-to-their-json-responses
                if (noAuthentication) {
                    reply(ATTACK_SAFE_JSON+data).ttl(EXPIRE_ONE_YEAR).etag(viewComponentNrs[affinityView].hash).header('x-noauth', 'true');
                }
                else {
                    reply(ATTACK_SAFE_JSON+data).ttl(EXPIRE_ONE_YEAR).etag(viewComponentNrs[affinityView].hash);
                }
            }
            else if (ajaxCss) {
                if (!viewComponentNrs[affinityView]) {
                    return reply('file not found').code(404);
                }
                data = await cachedFileContent.readFile(cwd+buildPrefix+'private/assets/css/'+viewComponentNrs[affinityView].cssfile, 'utf8');
                if (noAuthentication) {
                    reply(data).ttl(EXPIRE_ONE_YEAR).etag(viewComponentNrs[affinityView].cssfile).header('x-noauth', 'true');
                }
                else {
                    reply(data).ttl(EXPIRE_ONE_YEAR).etag(viewComponentNrs[affinityView].cssfile);
                }
            }
            else if (ajaxProperties) {
                // refresh the ttl of the cookies
                refreshCookies.refresh(request, reply, appConfig);
                if (noAuthentication) {
                    reply(props).header('x-noauth', 'true');
                }
                else {
                    reply(props);
                }
            }
            else {
                if (DEFINED_VIEWS[affinityView]===true) {
                    // refresh the ttl of the cookies
                    refreshCookies.refresh(request, reply, appConfig);
                    if (noAuthentication) {
                        reply.view(affinityView, props).header('x-noauth', 'true');
                    }
                    else {
                        reply.view(affinityView, props);
                    }
                }
                else {
                    if (DEFINED_VIEWS[affinityView]===undefined) {
                        try {
                            await fs.stat(cwd+'/build/view_components/'+affinityView+'.js');
                            DEFINED_VIEWS[affinityView] = true;
                            if (noAuthentication) {
                                reply.view(affinityView, props).header('x-noauth', 'true');
                            }
                            else {
                                reply.view(affinityView, props);
                            }
                            return; // no further processing
                        }
                        catch (err) {
                            DEFINED_VIEWS[affinityView] = false;
                        }
                    }
                    try {
                        file404 = cwd+'/src/'+FILE404;
                        await fs.stat(file404);
                        reply.file(file404).code(404);
                    }
                    catch (err) {
                        reply().code(404);
                    }
                }
            }
        }
        catch (err) {
            console.warn(err);
            reply(err);
        }

    });
};

module.exports = {
    extend
};
