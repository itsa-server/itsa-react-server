'use strict';

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
    defineProps(reply, props) {
        if (typeof props==='object') {
            this._storeTempRepliedCookie(props);
            reply.state(this.cookieName, props);
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
    setProps(reply, props) {
        let cookie;
        if (typeof props==='object') {
            cookie = this.getProps();
            cookie.itsa_merge(props, {force: true});
            this._storeTempRepliedCookie(cookie);
            reply.state(this.cookieName, cookie);
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
                reply.state(this.cookieName, cookie);
            }
        }
    },
    removeCookie(reply) {
        reply.unstate(this.cookieName, {ttl: 0});
    },
    changeTtl(reply, sec) {
        let cookie = this.getProps(),
            ttl;
        if (cookie) {
            ttl = (typeof sec==='number') ? sec*1000 : true;
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
