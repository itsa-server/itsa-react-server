'use strict';

// Requests replayed against hapi 16 (recording) and hapi 21 (tests/parity.test.js).
// `cookiesFrom` lists earlier requests (same configuration) whose Set-Cookie headers are sent along.
// Order matters: the plugin caches per view, and `cookie-ttl` changes a module-level ttl, so it is last.

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    PROPS_URL = '/_itsa_server_ajax_/props/aaa111/';

module.exports = {
    plain: [
        {name: 'page-root', url: '/'},
        {name: 'page-root-query', url: '/?x=1&_ts=123'},
        {name: 'page-lang-url', url: '/nl/'},
        {name: 'page-lang-url-no-slash', url: '/nl'},
        {name: 'page-accept-language', url: '/', headers: {'accept-language': 'nl-NL,nl;q=0.9,en;q=0.8'}},
        {name: 'page-phone', url: '/', headers: {'user-agent': IPHONE}},
        {name: 'page-bodydata', url: '/bodydata'},
        {name: 'page-missing-view', url: '/missing-view'},
        {name: 'page-not-found-html', url: '/does/not/exist'},
        {name: 'page-not-found-asset', url: '/does/not/exist.png'},
        {name: 'ajax-props', url: PROPS_URL},
        {name: 'ajax-props-lang', url: '/_itsa_server_ajax_/props/aaa111/nl/'},
        {name: 'ajax-comp', url: '/_itsa_server_ajax_/comp/aaa111/'},
        {name: 'ajax-css', url: '/_itsa_server_ajax_/css/aaa111/'},
        {name: 'ajax-comp-missing-view', url: '/_itsa_server_ajax_/comp/aaa111/missing-view'},
        {name: 'generated-props', url: '/generated-props'},
        {name: 'asset-helper', url: '/asset-helper'},
        {name: 'act-value', url: '/act/value'},
        {name: 'act-value-lang', url: '/nl/act/value'},
        {name: 'act-value-x-lang', url: '/act/value', headers: {'x-lang': 'nl'}},
        {name: 'act-empty', url: '/act/empty'},
        {name: 'act-response', url: '/act/response'},
        {name: 'act-stream', url: '/act/stream'},
        {name: 'act-boom', url: '/act/boom'},
        {name: 'act-throws', url: '/act/throws'},
        {name: 'act-missing', url: '/act/missing'},
        {name: 'act-not-a-function', url: '/act/not-a-function'},
        {name: 'act-options', url: '/act/options'},
        {name: 'act-payload', method: 'POST', url: '/act/payload', payload: {a: 1}},
        {name: 'request-info', url: '/act/request-info?q=1'},
        {name: 'request-info-lang', url: '/nl/act/request-info?q=1'},
        {name: 'request-info-ajax', url: '/_itsa_server_ajax_/props/aaa111/nl/act/request-info'},
        {name: 'favicon', url: '/favicon.ico'},
        {name: 'asset-unversioned', url: '/assets/hello.txt'},
        {name: 'asset-versioned', url: '/assets/1.0.0/hello.txt'},
        {name: 'asset-deep', url: '/assets/1.0.0/sub/deep.txt'},
        {name: 'asset-private', url: '/assets-private/1.0.0/secret.txt'},
        {name: 'asset-local', url: '/assets/local/js/aaa111.js'},
        {name: 'asset-external', url: '/assets/_itsa_server_external_modules/react/x.js'},
        {name: 'serviceworker-disabled', url: '/_itsa_server_serviceworker.js'}
    ],
    cookies: [
        {name: 'cookie-define', url: PROPS_URL, headers: {'x-cookie': 'itsa-props', 'x-action': 'define', 'x-cookieprops': '{"color":"blue","size":3}'}},
        {name: 'cookie-read-after-define', url: '/act/cookies', cookiesFrom: ['cookie-define']},
        {name: 'cookie-set', url: PROPS_URL, headers: {'x-cookie': 'itsa-props', 'x-action': 'set', 'x-cookieprops': '{"size":4}'}, cookiesFrom: ['cookie-define']},
        {name: 'cookie-read-after-set', url: '/act/cookies', cookiesFrom: ['cookie-define', 'cookie-set']},
        {name: 'cookie-delete', url: PROPS_URL, headers: {'x-cookie': 'itsa-props', 'x-action': 'delete', 'x-key': 'color'}, cookiesFrom: ['cookie-define', 'cookie-set']},
        {name: 'cookie-read-after-delete', url: '/act/cookies', cookiesFrom: ['cookie-define', 'cookie-set', 'cookie-delete']},
        {name: 'cookie-bodydata-define', url: PROPS_URL, headers: {'x-cookie': 'itsa-bodydata', 'x-action': 'define', 'x-cookieprops': '{"zoom":"2"}'}},
        {name: 'page-with-bodydata-cookie', url: '/', cookiesFrom: ['cookie-bodydata-define']},
        {name: 'page-with-bodydata-cookie-again', url: '/', cookiesFrom: ['cookie-bodydata-define']},
        {name: 'cookie-notexposed-action', url: '/act/set-notexposed'},
        {name: 'cookie-read-notexposed', url: '/act/cookies', cookiesFrom: ['cookie-notexposed-action']},
        {name: 'globalstate-cookie', url: '/act/cookies', headers: {cookie: 'globalstate='+encodeURIComponent('{"a":1}')}},
        {name: 'ajax-props-refresh', url: PROPS_URL, cookiesFrom: ['cookie-define']},
        {name: 'cookie-remove', url: PROPS_URL, headers: {'x-cookie': 'itsa-props', 'x-action': 'remove'}, cookiesFrom: ['cookie-define']},
        {name: 'cookie-ttl', url: PROPS_URL, headers: {'x-cookie': 'itsa-props', 'x-action': 'ttl', 'x-ms': '600'}, cookiesFrom: ['cookie-define']}
    ],
    auth: [
        {name: 'auth-public', url: '/public'},
        {name: 'auth-private-anonymous', url: '/private'},
        {name: 'auth-private-anonymous-ajax', url: '/_itsa_server_ajax_/props/eee555/private'},
        {name: 'auth-legacy-config-anonymous', url: '/legacy-config-private'},
        {name: 'auth-client-routes', url: '/_itsa_server_ajax_/props/aaa111/public'},
        {name: 'auth-login-user', method: 'POST', url: '/login', payload: {scope: 'user'}},
        {name: 'auth-private-user', url: '/private', cookiesFrom: ['auth-login-user']},
        {name: 'auth-private-user-again', url: '/private', cookiesFrom: ['auth-login-user']},
        {name: 'auth-admin-user', url: '/admin', cookiesFrom: ['auth-login-user']},
        {name: 'auth-login-blocked', method: 'POST', url: '/login', payload: {scope: 'user', blocked: true}},
        {name: 'auth-private-blocked', url: '/private', cookiesFrom: ['auth-login-blocked']},
        {name: 'auth-logout', method: 'POST', url: '/logout', cookiesFrom: ['auth-login-user']},
        {name: 'auth-validate-logout', url: '/private?logout=toolkit', cookiesFrom: ['auth-login-user']},
        {name: 'auth-serviceworker-init', url: '/private', headers: {'x-itsa-serviceworker-init': 'true'}}
    ]
};
