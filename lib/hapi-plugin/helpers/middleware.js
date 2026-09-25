/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

const Contextualizer = require('./contextualizer'),
    Ddos = require('./ddos-prevention');

const generate = async (server, cacheList, appConfig) => {
    const itsaAjaxRegexp = new RegExp('^/_itsa_server_ajax_/(comp|css|props)/\\w+(/|$)');
    let ddos;

    ddos = new Ddos(appConfig['ddos-prevention'].itsa_merge({
        serviceWorkerItemCount: cacheList.length,
        isDevelopment: (appConfig.envName!=='production')
    }, {force: true}));

    server.ext('onRequest', (request, h) => {
        // first, check DDOS attack:
        const ddosResponse = ddos.handle(request);
        if (ddosResponse.ok) {
            return h.continue;
        }
        // else
        return h.response(ddosResponse.message).code(ddosResponse.statusCode).takeover();
    });

    server.ext('onRequest', (request, h) => {
        let path, secondSlash, possibleLang, acceptLanguage, acceptLanguages, qualityDivider, match;

        // setting middleware for defining :
        request.affinity = ((appConfig.device==='phone') || (appConfig.device==='tablet')) ?
            appConfig.device :
            Contextualizer.getDevice(request.headers['user-agent']);

        path = request.path;
        // check if the path equals an SPA ajax request, in which case we will remove the leading information from the path:
        match = path.match(itsaAjaxRegexp);
        if (match) {
            request.headers['x-ajaxtype'] = match[1];
            path = '/'+path.substr(match[0].length);
        }
        // setting middleware for defining language:
        secondSlash = path.indexOf('/', 1);
        possibleLang = (secondSlash!==-1) ? path.substring(1, secondSlash) : path.substring(1);
        if (appConfig.languages[possibleLang]) {
            request.language = possibleLang;
            request.locales = [possibleLang];
            path = (secondSlash!==-1) ? path.substr(secondSlash) : '/';
            // set languageSwitch whenever the language differs from the clients default
            request.languageSwitch = true;
        }
        else {
            acceptLanguage = request.headers['accept-language'];
            acceptLanguages = acceptLanguage && acceptLanguage.split(',');
            // no language forced by url --> check the language from the request
            acceptLanguages && acceptLanguages.some(function(lang) {
                lang = lang.trim();
                qualityDivider = acceptLanguage.indexOf(';');
                if (qualityDivider>-1) {
                    lang = lang.substr(0, qualityDivider);
                }
                possibleLang = lang.split('-')[0];
                if (appConfig.languages[possibleLang]) {
                    request.language = possibleLang;
                    request.locales = [lang];
                }
                return request.language;
            });
            request.language || (request.language=appConfig.defaultLanguage);
            request.locales || (request.locales=[appConfig.defaultLanguage]);
        }
        // hapi 21: the path is read-only, rewrite the url instead (keeps the query)
        if (path!==request.path) {
            request.setUrl(path+request.url.search);
        }
        return h.continue;
    });
};

module.exports = {
    generate
};
