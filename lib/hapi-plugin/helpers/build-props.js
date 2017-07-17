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

const REGEXP_TS = /_ts=\d+/,
    preBoot = require('./preboot'),
    findPackageVersion = require('../../find-package-version'),
    SOCKET_IO = 'socket.io-client/dist/socket.io.js',
    Path = require('path'),
    useragent = require('useragent'),
    fs = require('fs-extra'),
    cwd = process.cwd(),
    polyfillRequestAnimationFrame = fs.readFileSync(cwd+'/node_modules/itsa-react-server/lib/polyfills/request-animation-frame.min.js', 'utf8');

const generate = (request, view, appTitles, config, appConfig, clientRoutes, startupTime) => {
    let props = {},
        clientLang, affinityTitle, urisplit, authCookie, socketIoClient;
    // set props.__appProps.lang and __locales for usage inside templates
    // if request.headers['x-lang'] then the client forces the language to be re-set
    clientLang = request.headers['x-lang'];
    // check if it is a valid langage
    if (clientLang && !appConfig.languages[clientLang]) {
        clientLang = null; // undo
    }
    // set the tile in the right language
    if (request.affinity==='phone') {
        affinityTitle = appTitles[view+'@phone'];
    }
    if (!affinityTitle && (request.affinity==='tablet')) {
        affinityTitle = appTitles[view+'@tablet'];
    }
    if (!affinityTitle) {
        affinityTitle = appTitles[view];
    }
    props = config.props || {};
    props.__bodyDataAttr || (props.__bodyDataAttr = {});
    props.__appProps || (props.__appProps = {});
    if (appConfig.cookies) {
        if (appConfig.cookies['body-data-attr'] && appConfig.cookies['body-data-attr'].enabled) {
            props.__appProps.bodyattrcookie = {};
        }
        if (appConfig.cookies.props && appConfig.cookies.props.enabled) {
            props.__appProps.cookie = request.getPropsCookie().getProps();
        }
    }
    props.__appProps.showOffline = appConfig.showOffline;
    props.__appProps.showEnvironment = appConfig.showEnvironment;

    props.__appProps.serverStartup = startupTime;
    props.__appProps.lang = clientLang || (appConfig.languages[request.language] && request.language) || appConfig.defaultLanguage;
    props.__appProps.langprefix = request.languageSwitch ? '/'+props.__appProps.lang : '';
    props.__appProps.locales = request.locales || appConfig.defaultLanguage;

    // set NODE_ENV
    props.__appProps['node_env'] = process.env.NODE_ENV || 'local';
    // set the version:
    props.__appProps.version = appConfig.packageVersion;
    // set the assets in the right version:
    props.__appProps.assetsdir = '/assets/'+appConfig.packageVersion+'/';
    props.__appProps['external_css_links'] = appConfig['external-css-links'];
    props.__appProps['external_js_links'] = appConfig['external-js-links'];

    props.__appProps.itsaprebootstartscript = preBoot.startScript();
    props.__appProps.itsaprebootendscript = preBoot.endScript();

    // set props.__appProps.view so it can be used inside the template:
    props.__appProps.view = view;
    // set props.__appProps.device so it can be used inside the template:
    props.__appProps.device = request.affinity;
    // set the page-title:
    props.__appProps.title = affinityTitle ? (affinityTitle[props.__appProps.lang] || '') : '';
    // set the meta-description:
    props.__appProps.description = config.description || appConfig['page-description'] || '';
    // set the charset:
    props.__appProps.charset = config.charset || 'utf-8';
    // set the useragent:
    props.__appProps.useragent = useragent.parse(request.headers['user-agent'] || '');
    // set the manifest metatags:
    props.__appProps.metatags = appConfig.metatags;
    // set the manifest links:
    props.__appProps.links = appConfig.links;

    // set the uri:
    // if the uri contains clientside timestamp, then remove it: we don't want to keep it
    props.__appProps.uri = request.url.path.replace(REGEXP_TS, '').itsa_replaceAll('//', '/');
    if (props.__appProps.uri.endsWith('?') || props.__appProps.uri.endsWith('&')) {
        props.__appProps.uri = props.__appProps.uri.substr(0, props.__appProps.uri.length-1);
    }
    // set the pathh, defined as uri without `?`:
    urisplit = props.__appProps.uri.split('?');
    props.__appProps.path = urisplit ? urisplit[0] : props.__appProps.uri;

    // set google-analytics:
    props.__appProps.ga = appConfig['google-analytics'];
    // set the meta-viewport
    props.__appProps.viewport = config.viewport ? config.viewport[request.affinity] : appConfig['meta-viewport'][request.affinity];
    // set the react-routes to be available on the client, onot when onlyProperties are requested:
    props.__appProps.routes = clientRoutes[request.affinity];
    // set the available languages
    props.__appProps.languages = appConfig.languages;

    if (appConfig.socketServer && appConfig.socketServer.enabled) {
        props.__appProps.socketport = appConfig.socketServer['proxy-port'];
        socketIoClient = ((appConfig.cdn && appConfig.cdn.enabled) ?
            appConfig.cdn.url+'assets/_itsa_server_external_modules/'+findPackageVersion.getVersion(SOCKET_IO)+'/' :
            (Path.resolve('/assets/_itsa_server_external_modules/'+findPackageVersion.getVersion(SOCKET_IO))+'/')) + SOCKET_IO;
        // prevent multiple references:
        if (!props.__appProps['external_js_links'].itsa_contains(socketIoClient)) {
            props.__appProps['external_js_links'].push(socketIoClient);
        }
    }
    props.__appProps.clientConfig = (appConfig['client-props'] || {}).itsa_deepClone();
    if (appConfig['app-authentication'] && appConfig['app-authentication'].enabled) {
        authCookie = request.getAuthCookie();
    }
    if (authCookie) {
        props.__appProps.loggedIn = authCookie.isLoggedIn();
        props.__appProps.scope = authCookie.getProps().scope;
    }
    if (appConfig['babel-polyfill']) {
        // also polyfil request animantion frame
        props.__appProps.polyfillRequestAnimationFrame = polyfillRequestAnimationFrame;
    }
    return props;
};

module.exports = {
    generate
};
