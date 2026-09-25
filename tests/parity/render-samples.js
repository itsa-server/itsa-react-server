'use strict';

// Props rendered through lib/hapi-plugin/helpers/jsx-view.js on React 15 (recorded) and React 16 (test).
// `escaping` holds every character React escapes, so an escaping change shows up.

module.exports = {
    index: {
        view: 'index',
        props: {
            __appProps: {view: 'index', lang: 'en', langprefix: '', locales: ['en'], path: '/', uri: '/?x=1', device: 'desktop', title: 'Home'},
            __bodyDataAttr: {'data-theme': 'dark'},
            authentication: true,
            fromModel: 42,
            general: 'yes'
        }
    },
    escaping: {
        view: 'login',
        props: {
            __appProps: {view: 'login', lang: 'nl', title: 'Log <in> & "go" \'now\''},
            __bodyDataAttr: {},
            authentication: false,
            authenticationMsg: 'Tom\'s <b>"quoted"</b> & more'
        }
    }
};
