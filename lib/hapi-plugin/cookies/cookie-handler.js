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

const COOKIE_NAME = 'itsa-info',
    Cookie = require('./cookie');

module.exports = {
    register(server, propsConfig, notExposedConfig, bodyDataConfig, globalstatesConfig, cookiePasswords) {
        const serverConnection = server;
        let hasPropsCookies = (propsConfig &&propsConfig.enabled),
            hasNotExposedCookies = (notExposedConfig && notExposedConfig.enabled),
            hasBodyDataCookies = (bodyDataConfig && bodyDataConfig.enabled),
            hasGlobalstateCookies = (globalstatesConfig && globalstatesConfig.enabled);

        if (hasBodyDataCookies) {
            new Cookie({
                cookieName: 'itsa-bodydata',
                server: serverConnection,
                options: bodyDataConfig.itsa_deepClone().itsa_merge({password: cookiePasswords['body-data-attr']})
            });
            server.decorate('request', 'getBodyDataAttrCookie', function() {
                return new Cookie({
                    cookieName: 'itsa-bodydata',
                    request: this
                });
            });
        }
        if (hasPropsCookies) {
            new Cookie({
                cookieName: 'itsa-props',
                server: serverConnection,
                options: propsConfig.itsa_deepClone().itsa_merge({password: cookiePasswords.props})
            });
            server.decorate('request', 'getPropsCookie', function() {
                return new Cookie({
                    cookieName: 'itsa-props',
                    request: this
                });
            });
        }
        if (hasNotExposedCookies) {
            new Cookie({
                cookieName: 'itsa-notexposed',
                server: serverConnection,
                options: notExposedConfig.itsa_deepClone().itsa_merge({password: cookiePasswords['not-exposed']})
            });
            server.decorate('request', 'getNotExposedCookie', function() {
                return new Cookie({
                    cookieName: 'itsa-notexposed',
                    request: this
                });
            });
        }
        if (hasGlobalstateCookies) {
            server.decorate('request', 'getClientGlobalstate', function() {
                let globalstate;
                try {
                    if (this.state && this.state.globalstate) {
                        globalstate = JSON.itsa_parseWithDate(decodeURIComponent(this.state.globalstate));
                    }
                    else {
                        globalstate = {};
                    }
                }
                catch (err) {
                    globalstate = {};
                }
                return globalstate;
            });
        }
    },
    cookieName: COOKIE_NAME
};
