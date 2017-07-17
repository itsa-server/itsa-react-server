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
    var serverConnection = server.root,
        itsaAjaxRegexp = new RegExp('^/_itsa_server_ajax_/(comp|css|props)/\\w+(/|$)'),
        ddos;

    ddos = new Ddos(appConfig['ddos-prevention'].itsa_merge({
        serviceWorkerItemCount: cacheList.length,
        isDevelopment: (appConfig.envName!=='production')
    }, {force: true}));

    serverConnection.ext('onRequest', (request, reply) => {
        // first, check DDOS attack:
        const ddosResponse = ddos.handle(request);
        if (ddosResponse.ok) {
            return reply.continue();
        }
        // else
        return reply(ddosResponse.message).code(ddosResponse.statusCode);
    });

    serverConnection.ext('onRequest', (request, reply) => {
        var path, secondSlash, possibleLang, acceptLanguage, acceptLanguages, qualityDivider,
            languageLength, match, startIndex;

        // setting middleware for defining :
        request.affinity = ((appConfig.device==='phone') || (appConfig.device==='tablet')) ?
            appConfig.device :
            Contextualizer.getDevice(request.headers['user-agent']);

        path = request.path;
        // check if the path equals an SPA ajax request, in which case we will remove the leading information from the path:
        match = path.match(itsaAjaxRegexp);
        if (match) {
            startIndex = match[0].length;
            request.headers['x-ajaxtype'] = match[1];
            path = request.path = '/'+ request.path.substr(startIndex);
            request.url.pathname = '/'+ request.url.pathname.substr(startIndex);
            request.url.path = '/'+ request.url.path.substr(startIndex);
            request.url.href = '/'+ request.url.href.substr(startIndex);
        }
        // setting middleware for defining language:
        secondSlash = path.indexOf('/', 1);
        possibleLang = (secondSlash!==-1) ? path.substring(1, secondSlash) : path.substring(1);
        if (appConfig.languages[possibleLang]) {
            request.language = possibleLang;
            request.locales = [possibleLang];
            if (secondSlash!==-1) {
                request.path = request.path.substr(secondSlash);
                request.url.pathname = request.url.pathname.substr(secondSlash);
                request.url.path = request.url.path.substr(secondSlash);
                request.url.href = request.url.href.substr(secondSlash);
            }
            else {
                languageLength = path.length;
                request.path = '/' + request.path.substr(languageLength);
                request.url.pathname = '/' +request.url.pathname.substr(languageLength);
                request.url.path = '/' + request.url.path.substr(languageLength);
                request.url.href = '/' + request.url.href.substr(languageLength);
            }

            // set languageSwitch whenever the language differs from the clients default
            request.languageSwitch = true;
            return reply.continue();
        }

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
        return reply.continue();
    });
};

module.exports = {
    generate
};
