'use strict';

// hapi 16 twin of tests/fixtures/app/src/routes.js — same paths, same behaviour, `reply` style.

const routes = [
    {method: 'GET', path: '/', handler: function(request, reply) { reply.reactview('index'); }},
    {method: 'GET', path: '/missing-view', handler: function(request, reply) { reply.reactview('does-not-exist'); }},
    {
        method: 'GET',
        path: '/bodydata',
        handler: function(request, reply) {
            reply.setBodyDataAttr({theme: 'dark', count: 2});
            reply.reactview('index');
        }
    },
    {
        method: 'GET',
        path: '/generated-props',
        handler: function(request, reply) {
            reply.generateProps('index').then(props => {
                reply({
                    view: props.__appProps.view,
                    fromModel: props.fromModel,
                    general: props.general,
                    authentication: props.authentication
                });
            });
        }
    },
    {method: 'GET', path: '/asset-helper', handler: function(request, reply) { reply.assets('hello.txt'); }},
    {method: 'GET', path: '/asset-helper/{file*}', handler: function(request, reply) { reply.assets(request.params.file); }},
    {method: 'GET', path: '/act/value', handler: function(request, reply) { reply.action('value'); }},
    {method: 'GET', path: '/act/empty', config: {handler: function(request, reply) { reply.action('empty'); }}},
    {method: 'GET', path: '/act/response', config: {handler: function(request, reply) { reply.action('response'); }}},
    {method: 'GET', path: '/act/stream', handler: function(request, reply) { reply.action('stream'); }},
    {method: 'GET', path: '/act/boom', handler: function(request, reply) { reply.action('boom'); }},
    {method: 'GET', path: '/act/throws', handler: function(request, reply) { reply.action('throws'); }},
    {method: 'GET', path: '/act/missing', handler: function(request, reply) { reply.action('does-not-exist'); }},
    {method: 'GET', path: '/act/not-a-function', handler: function(request, reply) { reply.action('not-a-function'); }},
    {method: 'GET', path: '/act/options', handler: function(request, reply) { reply.action('options', {inline: true}); }},
    {method: 'POST', path: '/act/payload', handler: function(request, reply) { reply.action('payload'); }},
    {method: 'GET', path: '/act/request-info', handler: function(request, reply) { reply.action('request-info'); }},
    {method: 'GET', path: '/act/cookies', handler: function(request, reply) { reply.action('cookies'); }},
    {method: 'GET', path: '/act/set-notexposed', handler: function(request, reply) { reply.action('set-notexposed'); }}
];

if (process.env.ITSA_FIXTURE_AUTH==='true') {
    routes.push(
        {method: 'GET', path: '/public', handler: function(request, reply) { reply.reactview('index'); }},
        {
            method: 'GET',
            path: '/private',
            config: {
                auth: {strategy: 'fixture', scope: ['user', 'admin']},
                handler: function(request, reply) { reply.reactview('private'); }
            }
        },
        {
            method: 'GET',
            path: '/admin',
            config: {
                auth: {strategy: 'fixture', scope: ['admin']},
                handler: function(request, reply) { reply.reactview('private'); }
            }
        },
        {
            method: 'GET',
            path: '/legacy-config-private',
            config: {
                auth: {strategy: 'fixture', scope: ['user']},
                handler: function(request, reply) { reply.reactview('private'); }
            }
        },
        {method: 'POST', path: '/login', handler: function(request, reply) { reply.action('login'); }},
        {method: 'POST', path: '/logout', handler: function(request, reply) { reply.action('logout'); }}
    );
}

module.exports = routes;
