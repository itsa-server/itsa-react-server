// Fork from `hapi-auth-cookie`
// Extended with the config-property `loginView`, which should be a view
// with a login-form which stes the cookie after succesful login

'use strict';

require('itsa-jsext');

const COOKIE_NAME = 'itsa-id',
    AuthCookie = require('./auth-cookie');

const DEFAULT_COOKIE_OPTIONS = {
    encoding: 'iron',
    isSecure: true,
    path: '/',
    isHttpOnly: true,
    clearInvalid: true,
    ignoreErrors: true
};

// Declare internals
let internals = {};

exports.register = function(server, options, next) {
    const serverConnection = server.root,
        ttl = options['ttl-sec'] ? options['ttl-sec']*1000 : null;
    let cookieOptions = DEFAULT_COOKIE_OPTIONS.itsa_deepClone().itsa_merge(options, {force: true});
    // setup the cookie:
    new AuthCookie({
        cookieName: COOKIE_NAME,
        server: serverConnection,
        options: cookieOptions
    });
    server.decorate('request', 'getLoginCookie', function() {
        return new AuthCookie({
            cookieName: COOKIE_NAME,
            request: this
        });
    });
    server.decorate('reply', 'logout', function() {
        const reply = this,
            request = reply.request;
        request.getLoginCookie().removeCookie(reply);
    });
    server.decorate('reply', 'login', function(credentials, stayLoggedIn, userTtl) {
        const reply = this,
            request = reply.request;
        request.getLoginCookie().defineProps(reply, credentials, stayLoggedIn ? (userTtl || ttl) : null);
    });
    server.root.auth.scheme('itsa-react-server-auth', internals.implementation);
    next();
};

exports.register.attributes = {
    name: 'itsaReactServerAuth',
    version: '1.0.0'
};

internals.implementation = function(server, options) {
    const validateFunc = options.validateFunc,
        loginView = options.loginView;

    server.ext('onPreResponse', function(request, reply) {
        let response = request.response;
        if (response.isBoom && response.output && (response.output.statusCode===403)) {
            return reply.reactview(loginView, {__sendRequireId__: true});
        }
        return reply.continue();
    });

    var scheme = {
        authenticate: function(request, reply) {
            const validate = async function() {
                // Check cookie
                let validated, authCookie;
                try {
                    authCookie = request.getLoginCookie();
                    // now check by validateFunc (if any)
                    validated = (typeof validateFunc==='function') ? await validateFunc(request, reply, authCookie) : true;
                    if (!validated) {
                        // authCookie.removeCookie(reply);
                        reply.reactview(loginView, {__sendRequireId__: true, props: {__appProps: {authentication: false}}});
                    }
                    else {
                        reply.continue({credentials: authCookie.getProps()});
                    }
                }
                catch (err) {
                    reply.reactview(loginView, {__sendRequireId__: true, props: {__appProps: {authentication: false}}});
                }
            };
            validate();
        }
    };

    return scheme;
};
