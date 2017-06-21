'use strict';

const REGEXP_TS = /_ts=\d+/,
    preBoot = require('./preboot'),
    useragent = require('useragent');

const generate = (request, view, appTitles, config, appConfig, clientRoutes, startupTime) => {
    let props = {},
        clientLang, affinityTitle, urisplit;
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
    props.__bodyDataAttr = {};
    props.__appProps = {
        offline: false
    };
    if (appConfig.cookies) {
        if (appConfig.cookies['body-data-attr'] && appConfig.cookies['body-data-attr'].enabled) {
            props.__appProps.bodyattrcookie = {};
        }
        if (appConfig.cookies.props && appConfig.cookies.props.enabled) {
            props.__appProps.cookie = request.getPropsCookie().getProps();
        }
    }
    props.__appProps.showOffline = appConfig.showOffline;

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
    }

    props.__appProps.loggedIn = !!(appConfig['app-authentication'] && appConfig['app-authentication'].enabled && request.getLoginCookie().isLoggedIn());
    return props;
};

module.exports = {
    generate
};
