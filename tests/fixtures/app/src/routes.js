'use strict';

// Fixture routes in hapi 21 style: every handler returns.
// `options:` and the legacy `config:` key are both used on purpose.

const routes = [
    {method: 'GET', path: '/', handler: (request, h) => h.reactview('index')},
    {method: 'GET', path: '/missing-view', handler: (request, h) => h.reactview('does-not-exist')},
    {
        method: 'GET',
        path: '/bodydata',
        handler: (request, h) => {
            h.setBodyDataAttr({theme: 'dark', count: 2});
            return h.reactview('index');
        }
    },
    {
        method: 'GET',
        path: '/generated-props',
        handler: async (request, h) => {
            const props = await h.generateProps('index');
            return {
                view: props.__appProps.view,
                fromModel: props.fromModel,
                general: props.general,
                authentication: props.authentication
            };
        }
    },
    {method: 'GET', path: '/asset-helper', handler: (request, h) => h.assets('hello.txt')},
    {method: 'GET', path: '/asset-helper/{file*}', handler: (request, h) => h.assets(request.params.file)},
    {method: 'GET', path: '/act/value', handler: (request, h) => h.action('value')},
    {method: 'GET', path: '/act/empty', options: {handler: (request, h) => h.action('empty')}},
    {method: 'GET', path: '/act/response', config: {handler: (request, h) => h.action('response')}},
    {method: 'GET', path: '/act/stream', handler: (request, h) => h.action('stream')},
    {method: 'GET', path: '/act/boom', handler: (request, h) => h.action('boom')},
    {method: 'GET', path: '/act/throws', handler: (request, h) => h.action('throws')},
    {method: 'GET', path: '/act/missing', handler: (request, h) => h.action('does-not-exist')},
    {method: 'GET', path: '/act/not-a-function', handler: (request, h) => h.action('not-a-function')},
    {method: 'GET', path: '/act/legacy', handler: (request, h) => h.action('legacy')},
    {method: 'GET', path: '/act/options', handler: (request, h) => h.action('options', {inline: true})},
    {method: 'POST', path: '/act/payload', handler: (request, h) => h.action('payload')},
    {method: 'GET', path: '/act/request-info', handler: (request, h) => h.action('request-info')},
    {method: 'GET', path: '/act/cookies', handler: (request, h) => h.action('cookies')},
    {method: 'GET', path: '/act/set-notexposed', handler: (request, h) => h.action('set-notexposed')}
];

if (process.env.ITSA_FIXTURE_AUTH==='true') {
    routes.push(
        {method: 'GET', path: '/public', handler: (request, h) => h.reactview('index')},
        {
            method: 'GET',
            path: '/private',
            options: {
                auth: {strategy: 'fixture', scope: ['user', 'admin']},
                handler: (request, h) => h.reactview('private')
            }
        },
        {
            method: 'GET',
            path: '/admin',
            options: {
                auth: {strategy: 'fixture', scope: ['admin']},
                handler: (request, h) => h.reactview('private')
            }
        },
        {
            method: 'GET',
            path: '/legacy-config-private',
            config: {
                auth: {strategy: 'fixture', scope: ['user']},
                handler: (request, h) => h.reactview('private')
            }
        },
        {method: 'POST', path: '/login', handler: (request, h) => h.action('login')},
        {method: 'POST', path: '/logout', handler: (request, h) => h.action('logout')}
    );
}

if (process.env.ITSA_FIXTURE_BROKEN_ROUTES==='true') {
    throw new Error('fixture: broken routes');
}

module.exports = routes;
