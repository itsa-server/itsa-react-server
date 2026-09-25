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

const getValidScope = function(request) {
    const config = request.server.auth.lookup(request.route),
        access = config && config.access, // is an array
        item = access && access.find(item => item.scope),
        scope = item && item.scope.selection && item.scope.selection[0];
    return scope || 'unknown';
};

internals.implementation = function(server, options) {
    const validateFunc = options.validateFunc,
        loginView = options.loginView;

    const renderLoginView = async (h, authenticationMsg) => {
        const response = await h.reactview(loginView, {__sendRequireId__: true, __noAuth__: true, __authenticationMsg__: authenticationMsg});
        return response.takeover();
    };

    server.ext('onPreResponse', function(request, h) {
        // manage mismatches based upon the `scope`:
        const response = request.response;
        if (response.isBoom && response.output && (response.output.statusCode===403)) {
            console.debug(request, 'wrong authentication scope: redirecting to the loginView');
            return h.reactview(loginView, {__sendRequireId__: true, __noAuth__: true});
        }
        return h.continue;
    });

    return {
        authenticate: async function(request, h) {
            let validatedResponse, authCookie, authenticationMsg;
            if (request.headers['x-itsa-serviceworker-init']==='true') {
                return h.authenticated({credentials: {scope: getValidScope(request)}});
            }
            try {
                authCookie = request.getAuthCookie();
                // now check by validateFunc (if any)
                validatedResponse = (typeof validateFunc==='function') ? await validateFunc(request, h, authCookie) : true;
            }
            catch (err) {
                console.debug(request, 'general authentication error at the validateFn: redirecting to the loginView');
                return renderLoginView(h);
            }
            if (validatedResponse!==true) {
                if (typeof validatedResponse==='string') {
                    authenticationMsg = validatedResponse;
                }
                console.debug(request, 'no authentication by the validateFn: redirecting to the loginView');
                return renderLoginView(h, authenticationMsg);
            }
            return h.authenticated({credentials: authCookie.getProps()});
        }
    };
};

const register = async (server, options) => {
    const defaultTtlSec = options['ttl-sec'] ? options['ttl-sec'] : undefined,
        defaultSessionCookie = options['session-cookie'] || false,
        cookieOptions = DEFAULT_COOKIE_OPTIONS.itsa_deepClone().itsa_merge(options, {force: true});
    // setup the cookie:
    new AuthCookie({
        cookieName: COOKIE_NAME,
        server,
        options: cookieOptions
    });
    server.decorate('request', 'getAuthCookie', function() {
        return new AuthCookie({
            cookieName: COOKIE_NAME,
            request: this
        });
    });
    server.decorate('toolkit', 'logout', function() {
        const h = this;
        h.request.getAuthCookie().removeCookie(h);
    });
    server.decorate('toolkit', 'login', function(credentials, sessionCookie, userTtlSec) {
        const h = this;
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
        h.request.getAuthCookie().defineProps(h, credentials, ttlSec);
    });
    server.auth.scheme('itsa-react-server-auth', internals.implementation);
};

module.exports = {
    name: 'itsaReactServerAuth',
    version: '1.0.0',
    register
};
