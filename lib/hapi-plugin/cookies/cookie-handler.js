'use strict';

require('itsa-jsext');

const COOKIE_NAME = 'itsa-info',
    Cookie = require('./cookie');

module.exports = {
    register(server, propsConfig, notExposedConfig, bodyDataConfig, cookiePasswords) {
        const serverConnection = server.root;
        let hasPropsCookies = (propsConfig &&propsConfig.enabled),
            hasNotExposedCookies = (notExposedConfig && notExposedConfig.enabled),
            hasBodyDataCookies = (bodyDataConfig && bodyDataConfig.enabled);

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
    },
    cookieName: COOKIE_NAME
};
