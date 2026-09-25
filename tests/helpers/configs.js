'use strict';

// Named fixture configurations: manifest overrides plus environment variables the fixture's
// src/routes.js reads. Each test file uses one configuration (one per process), because the
// plugin keeps module-level state (cookie registrations, view caches).

module.exports = {
    plain: {
        env: {},
        overrides: {}
    },
    cookies: {
        env: {},
        overrides: {
            cookies: {
                'body-data-attr': {enabled: true, onlySsl: false, 'ttl-sec': 31536000},
                'not-exposed': {enabled: true, onlySsl: false, 'ttl-sec': 31536000},
                props: {enabled: true, onlySsl: false, 'ttl-sec': 31536000},
                globalstate: {enabled: true, onlySsl: false, 'ttl-sec': 365}
            }
        }
    },
    auth: {
        env: {ITSA_FIXTURE_AUTH: 'true'},
        overrides: {
            'app-authentication': {
                enabled: true,
                onlySsl: false,
                'session-cookie': false,
                'ttl-sec': 1800,
                loginView: 'login',
                strategies: [
                    {strategy: 'fixture', validateFunc: 'src/authentication/validate'}
                ]
            }
        }
    }
};
