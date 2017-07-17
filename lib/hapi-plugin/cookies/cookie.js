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

const Classes = require('itsa-classes'),
    REGISTERED_TTL = {},
    PROTECTED_COOKIE_OPTIONS = {
        encoding: 'iron',
        path: '/',
        isHttpOnly: true,
        clearInvalid: true,
        ignoreErrors: true
    };

/*
    config.cookieName
    config.server
    config.options
    (options.password options.ttl)
*/
var CookieBase = Classes.createClass(function(config) {
    this._register(config);
},
{
    _register(config) {
        let options = {};
        if (!config.cookieName) {
            console.warn('cannot to create a cookie without config.cookieName');
        }
        else {
            this.cookieName = config.cookieName;
            if (!REGISTERED_TTL[this.cookieName]) {
                if (!config.server) {
                    console.warn('cannot to initiate a cookie without config.server');
                }
                else if (!config.options) {
                    console.warn('cannot to initiate a cookie without config.options');
                }
                else if (!config.options.password) {
                    console.warn('cannot to initiate a cookie without config.options.password');
                }
                else if (config.options.password.length<32) {
                    console.warn('cannot to initiate a cookie: config.options.password needs to be 32 characters at the least');
                }
                else {
                    this.server = config.server;
                    options.password = config.options.password;
                    options.isSecure = (typeof config.options.onlySsl==='boolean') ? config.options.onlySsl : true, // <-- force cookies to be seen over https only!!
                    options.ttl = config.options['ttl-sec'];
                    options.itsa_merge(PROTECTED_COOKIE_OPTIONS, {force: true});
                    // initialize the configuration of the cookie.
                    // the cookie itself is not been defined yet!
                    if (options.ttl) {
                        options.ttl = options.ttl*1000;
                    }
                    this.server.state(this.cookieName, options);
                    REGISTERED_TTL[this.cookieName] = (typeof options.ttl==='number') ? options.ttl : true;
                }
            }
        }
    },
    defineProps(reply, props, ttlSec) {
        let ttlConfig;
        if (Object.itsa_isObject(props)) {
            this._storeTempRepliedCookie(props);
            if (ttlSec!==undefined) {
                ttlConfig = {
                    ttl: (typeof ttlSec==='number') ? ttlSec*1000 : undefined
                };
            }
            console.debug(reply.request, 'Define cookie', this.cookieName, props, 'ttlConfig:', ttlConfig);
            reply.state(this.cookieName, props, ttlConfig);
        }
    },
    getProps() {
        let cookie = this.request['__itsa_cookie_'+this.cookieName] || (this.request.state && this.request.state[this.cookieName]);
        // for some reasson, IE returns an array
        if (Array.isArray(cookie)) {
            cookie = cookie[0];
        }
        return Object.itsa_isObject(cookie) ? cookie : {};
    },
    setProps(reply, props, ttlSec) {
        let cookie, ttlConfig;
        if (Object.itsa_isObject(props)) {
            cookie = this.getProps();
            cookie.itsa_merge(props, {force: true});
            this._storeTempRepliedCookie(cookie);
            if (ttlSec!==undefined) {
                ttlConfig = {
                    ttl: (typeof ttlSec==='number') ? ttlSec*1000 : undefined
                };
            }
            console.debug(reply.request, 'Set props for cookie', this.cookieName, 'props:', cookie, 'ttlConfig:', ttlConfig);
            reply.state(this.cookieName, cookie, ttlConfig);
        }
    },
    cookieIsSet() {
        return !this.getProps().itsa_isEmpty();
    },
    deleteProp(reply, key) {
        let cookie;
        if (typeof key==='string') {
            cookie = this.getProps();
            if (cookie) {
                delete cookie[key];
                this._storeTempRepliedCookie(cookie);
                console.debug(reply.request, 'Delete property', key, 'from cookie', this.cookieName);
                reply.state(this.cookieName, cookie);
            }
        }
    },
    removeCookie(reply) {
        delete this.request['__itsa_cookie_'+this.cookieName];
        console.debug(reply.request, 'Remove cookie', this.cookieName);
        reply.unstate(this.cookieName, {ttl: 0});
    },
    changeTtl(reply, ttlSec) {
        let cookie = this.getProps(),
            ttl;
        if (cookie) {
            ttl = (typeof sec==='number') ? ttlSec*1000 : 0;
            REGISTERED_TTL[this.cookieName] = ttl;
            reply.state(this.cookieName, cookie, {ttl: ttl});
        }
    },
    refreshTtl(reply) {
        let cookie, ttl;
        if (this.cookieIsSet()) {
            ttl = REGISTERED_TTL[this.cookieName];
            cookie = this.getProps();
            reply.state(this.cookieName, cookie, {ttl: (typeof ttl==='number') ? ttl : undefined});
        }
    },
    _storeTempRepliedCookie(cookie) {
        this.request['__itsa_cookie_'+this.cookieName] = cookie;
    }
});

const Cookie = CookieBase.subClass(function(config) {
    // CookieBase gets automaticly invoked with 'config'
    this.request = config.request;
});

module.exports = Cookie;
