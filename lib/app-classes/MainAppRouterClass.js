/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

const ItsaRouterClass = require('../client-router'),
    MainAppClass = require('./MainAppClass'),
    ClientBodyDataAttrCookie = require('../hapi-plugin/cookies/client-body-data-attr-cookie'),
    ClientPropsCookie = require('../hapi-plugin/cookies/client-props-cookie'),
    ClientNotExposedCookie = require('../hapi-plugin/cookies/client-not-exposed-cookie');

const MainAppRouter = MainAppClass.subClass(function() {
    const instance = this,
        appProps = instance.getProps().__appProps,
        socketport = appProps.socketport;

    instance.router = new ItsaRouterClass();
    instance.bodyDataAttrCookie = new ClientBodyDataAttrCookie({
        router: instance.router,
        cookie: appProps.bodyattrcookie
    });
    instance.propsCookie = new ClientPropsCookie({
        router: instance.router,
        cookie: appProps.cookie
    });
    instance.notExposedCookie = new ClientNotExposedCookie({
        router: instance.router
    });

    // setup custom socketio:
    socketport && instance.setupSocketIO(socketport); // comes from `../socketio/socketio-client`

    // create listener to app:reboot, which will invoke this.saveStateOnReboot:
    instance.before('app:reboot', e => {
        e.state = instance.saveStateOnReboot();
    });

    // load the previous appstate and remove from localstorage:
    instance._prevAppState = document.itsa_localStorage_getItem('appstate', true);
    document.itsa_localStorage_removeItem('appstate');
},
{
    getStateAfterReboot() {
        return this._prevAppState;
    },

    saveStateOnReboot() {
        // to be overridden by the final web app
    },

    destroy: function() {
        this.destroySocketIO();
        this.router.destroy();
    }
}).mergePrototypes(require('../socketio/socketio-client'));

module.exports = MainAppRouter;
