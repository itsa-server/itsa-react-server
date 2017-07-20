/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

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
        defaultTtlSec = options['ttl-sec'] ? options['ttl-sec'] : undefined,
        defaultSessionCookie = options['session-cookie'] || false;
    let cookieOptions = DEFAULT_COOKIE_OPTIONS.itsa_deepClone().itsa_merge(options, {force: true});
    // setup the cookie:
    new AuthCookie({
        cookieName: COOKIE_NAME,
        server: serverConnection,
        options: cookieOptions
    });
    server.decorate('request', 'getAuthCookie', function() {
        return new AuthCookie({
            cookieName: COOKIE_NAME,
            request: this
        });
    });
    server.decorate('reply', 'logout', function() {
        const reply = this,
            request = reply.request;
        request.getAuthCookie().removeCookie(reply);
    });
    server.decorate('reply', 'login', function(credentials, sessionCookie, userTtlSec) {
        const reply = this,
            request = reply.request;
        let ttlSec;
        if ((typeof sessionCookie!=='boolean') && !userTtlSec) {
            sessionCookie = defaultSessionCookie;
        }
        if (typeof sessionCookie==='boolean') {
            ttlSec = sessionCookie ? null : (userTtlSec || defaultTtlSec); // set to `null`, NOT `undefined` --> force the new ttl to be set
        }
        else {
            ttlSec = userTtlSec || defaultTtlSec;
        }
        request.getAuthCookie().defineProps(reply, credentials, ttlSec);
    });
    server.root.auth.scheme('itsa-react-server-auth', internals.implementation);
    next();
};

exports.register.attributes = {
    name: 'itsaReactServerAuth',
    version: '1.0.0'
};

const getValidScope = function(request) {
    const config = request.connection.auth.lookup(request.route),
        access = config.access, // is an array
        item = access && access.find(item => item.scope),
        scope = item && item.scope.selection[0];
    return scope || 'unknown';
};

internals.implementation = function(server, options) {
    const validateFunc = options.validateFunc,
        loginView = options.loginView;

    server.ext('onPreResponse', function(request, reply) {
        // manage mismatches based upon the `scope`:
        let response = request.response;
        if (response.isBoom && response.output && (response.output.statusCode===403)) {
            console.debug(request, 'wrong authentication scope: redirecting to the loginView');
            return reply.reactview(loginView, {__sendRequireId__: true, __noAuth__: true});
        }
        return reply.continue();
    });

    var scheme = {
        authenticate: function(request, reply) {
            const validate = async function() {
                // Check cookie
                let validatedResponse, authCookie, authenticationMsg,
                    serviceWorkerInitRequest = (request.headers['x-itsa-serviceworker-init']==='true');
                if (serviceWorkerInitRequest) {
                    let scope = getValidScope(request);
                    reply.continue({credentials: {scope}});
                    return;
                }
                try {
                    authCookie = request.getAuthCookie();
                    // now check by validateFunc (if any)
                    validatedResponse = (typeof validateFunc==='function') ? await validateFunc(request, reply, authCookie) : true;
                    if (validatedResponse!==true) {
                        // authCookie.removeCookie(reply);
                        if (typeof validatedResponse==='string') {
                            authenticationMsg = validatedResponse;
                        }
                        console.debug(request, 'no authentication by the validateFn: redirecting to the loginView');
                        reply.reactview(loginView, {__sendRequireId__: true, __noAuth__: true, __authenticationMsg__: authenticationMsg});
                    }
                    else {
                        reply.continue({credentials: authCookie.getProps()});
                    }
                }
                catch (err) {
                    console.debug(request, 'general authentication error at the validateFn: redirecting to the loginView');
                    reply.reactview(loginView, {__sendRequireId__: true, __noAuth__: true});
                }
            };
            validate();
        }
    };

    return scheme;
};
