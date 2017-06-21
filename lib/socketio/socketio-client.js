/**
 * Setup for client-side socket-io.
 *
 * The socket-io is used to update the client whenever `this.props`
 * leads into a different view-rendering. This is monitored and managed by the server
 * (by listening to rethinkdb).
 *
 * <i>Copyright (c) 2016 AcceleTrial - https://acceletrial.com</i><br>
 * Proprietary License
 *
 *
 * @module modules/app-components/socketio.js
 * @class App
 * @since 2.0.0
*/

'use strict';

const socketIoClient = require('socket.io-client');

const Methods = {

    /**
     * Setup the client-side socket-io listener.
     *
     * @method setupSocketIO
     * @since 2.0.0
    */
    setupSocketIO(socketPort) {
        let socket, location;
        const instance = this;
        location = window.location;
        instance.socket = socket = socketIoClient(location.protocol + '//'+ location.hostname + ':' + socketPort);
        socket.on('connect', instance._socketConnected.bind(instance));
        socket.on('disconnect', instance._socketDisconnected.bind(instance));
        socket.on('propschanged', instance._socketPropsChanged.bind(instance));
        socket.on('versionchanged', instance._socketVersionChanged.bind(instance));
        socket.on('connect_error', instance._socketConnectError.bind(instance));
        // define a custom event for reboot:
        // can be done by 'this', which has an emitter of `app`:
        instance.defineEvent('reboot')
            .defaultFn(instance._defFnReboot.bind(instance));
    },

    destroySocketIO() {
        this.socket.removeAllListeners();
    },

    _socketConnected() {
        const instance = this,
            controller = instance.controller;
        instance._setHeadOffline(false);
        controller.setOnline();
        // check for `false` NOT `undefined`, we only want to reload the view if the connection got lost and reastablished:
        if (instance.connected===false) {
            instance.io.actualRequestsFinished()
                .itsa_finally(function() {
                    instance.router.reloadView(true);
                });
        }
        // notify the server the state of this client-instance:
        instance.socket.emit('clientconnected', {
            props: controller.getProps(),
            view: controller.getView()
        });
        instance.connected = true;
        instance.emit('connection:connected');
    },
    _setHeadOffline(offline) {
        window.document.documentElement.setAttribute('data-offline', offline.toString());
    },
    _socketDisconnected() {
        this.connected = false;
        this.emit('connection:disconnected');
    },
    _socketConnectError() {
        const controller = this.controller;
        let newProps;
        if (!controller.getProps().__appProps.offline) {
            this._setHeadOffline(true);
            newProps = controller.getClonedProps();
            // update the app that it is offline:
            newProps.__appProps.offline = true;
            controller.setOffline();
            controller.forceUpdate(newProps);
        }
    },

    _socketPropsChanged() {
        this.router.reloadView(true);
    },

    _saveState(state) {
        const instance = this;
        if (state) {
            document.itsa_localStorage_setItem('appstate', state);
        }
        else {
            document.itsa_localStorage_removeItem('appstate');
        }
    },

    _socketVersionChanged() {
        this.emit('reboot');
    },

    _defFnReboot(e) {
        // be carefull: if the server does not return status 200, then we would run into a never ending refreshing loop!
        // therefore, first check the response:
        const instance = this,
            pathname = window.location.pathname,
            stampPrefix = (pathname.indexOf('?')===-1) ? '?' : '&',
            url = pathname+stampPrefix+'_itsa_ts='+Date.now(); // add a datestamp: prevent data coming from the serviceworker

        instance.io.lockIO()
            .then(() => {
                if (e.state) {
                    return instance._saveState(e.state); // in case this will become a promise,=: wait for it
                }
            })
            .then(() => instance.io.get(url, {skipLockedIO: true}))
            .then(() => {
                window.location.reload(true); // no cache
                // NOTE: this is a full refresh of the page!
                // to prevent the `state` from being lost, the webapp should save its state on every state-change
                // in a Cookie and use this cookie as initial state!
                // You can use app.saveStateOnReboot() and app.getStateAfterReboot() to manage this
            }).catch((err) => {
                window.location = '/'; // severe error: try to goto the home page
            });
    }
};

module.exports = Methods;
