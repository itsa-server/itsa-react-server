/**
 * Setup for server-side socket-io.
 *
 * The socket-io is used to update the client whenever `this.props`
 * leads into a different view-rendering. This is monitored and managed this module
 * (by listening to rethinkdb).
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @module modules/services/socketserver.js
 * @class SocketServer
 * @since 2.0.0
*/

'use strict';

require('itsa-jsext');

let socketServerInstance = null;

const SocketIO = require('socket.io'),
    Hapi = require('@hapi/hapi'),
    Event = require('itsa-event'),
    Classes = require('itsa-classes'),
    later = require('itsa-utils').later,
    SEQUENTIAL_CLIENT_UPDATE_DELAY = 2000, // not too often: give the clients time to refresh and queue any server-changes
    // largest message a client may send, in bytes: `clientconnected` carries the page's props, so keep
    // the 100 MB of engine.io 3.3 instead of the 1 MB default of engine.io 3.6
    DEF_MAX_HTTP_BUFFER_SIZE = 1e8;

const SocketServer = Classes.createClass(function(config) {
    let port, host, server, immediateResponse, doubleResponse;
    const instance = this;
    instance._clientUpdates = [];
    instance._clientUpdatesDelayed = [];
    if (config) {
        if (Object.itsa_isObject(config.sequentialClientUpdate)) {
            immediateResponse = !config.sequentialClientUpdate.delay;
            doubleResponse = (config.sequentialClientUpdate['update-time'] && config.sequentialClientUpdate['delay-time']);
            if (immediateResponse) {
                instance.SEQUENTIAL_CLIENT_UPDATE_IMMEDIATE = config.sequentialClientUpdate['update-time'] || SEQUENTIAL_CLIENT_UPDATE_DELAY || config.sequentialClientUpdate['delay-time'];
                if (doubleResponse) {
                    instance.SEQUENTIAL_CLIENT_UPDATE_DELAY = config.sequentialClientUpdate['delay-time'] || SEQUENTIAL_CLIENT_UPDATE_DELAY || config.sequentialClientUpdate['update-time'];
                }
            }
            else {
                instance.SEQUENTIAL_CLIENT_UPDATE_DELAY = config.sequentialClientUpdate['delay-time'] || SEQUENTIAL_CLIENT_UPDATE_DELAY || config.sequentialClientUpdate['update-time'];
                if (doubleResponse) {
                    instance.SEQUENTIAL_CLIENT_UPDATE_IMMEDIATE = config.sequentialClientUpdate['update-time'] || SEQUENTIAL_CLIENT_UPDATE_DELAY || config.sequentialClientUpdate['delay-time'];
                }
            }
        }
        else {
            instance.SEQUENTIAL_CLIENT_UPDATE_IMMEDIATE = config.sequentialClientUpdate || SEQUENTIAL_CLIENT_UPDATE_DELAY;
        }
        port = config.port || 4002;
        host = config.host || '0.0.0.0';
        // if PM2 is running -and in cluster-mode-, we NEED a dedicated port for each and every instance!
        port += process.env.NODE_APP_INSTANCE ? parseInt(process.env.NODE_APP_INSTANCE, 10) : 0; // see https://github.com/Unitech/PM2/issues/1510
        instance.server = server = Hapi.server({
            host,
            port
        });
        instance._serverStartupTime = config.serverStartupTime;
        instance.socketIO = SocketIO(server.listener, {
            // no websocket compression: every connection kept its own zlib context (about 300 KB),
            // and with ws < 7.1.2 a client that disconnected during a compression stalled all later
            // ones, which then stayed in memory for good
            perMessageDeflate: false,
            maxHttpBufferSize: config.maxHttpBufferSize || DEF_MAX_HTTP_BUFFER_SIZE
        });
        instance.socketConnections = new Map();
        instance.setupConnectionListeners();
        server.start().catch(err => {
            console.error(err);
        });
        instance.setupEventListener();
    }
},
{
    /**
     * Sents a `propschanged` event to the clients, through the socketIO.
     * Has code to prevent overloading, by limit the update time into once per some seconds
     *
     * @method updateAllClients
     * @since 2.0.0
     */
    updateAllClients(payload, err, changes) {
        const instance = this,
            inform = delayedResponse => {
                const clientUpdatesField = [delayedResponse ? '_clientUpdatesDelayed' : '_clientUpdates'];
                instance.socketConnections.forEach((value, socketConnection) => {
                    // inform the client to re-render its view
                    socketConnection.emit('propschanged', {changes: instance[clientUpdatesField], delayedResponse});
                });
                instance[clientUpdatesField].length = 0;
            };
        if (!payload) {
            payload = {};
        }
        if (Object.itsa_isObject(changes)) {
            payload.itsa_merge(changes, {force: true});
        }
        if (instance.SEQUENTIAL_CLIENT_UPDATE_IMMEDIATE) {
            instance._clientUpdates.push(payload);
            if (!instance._delayInformTimer) {
                instance._delayInformTimer = later(() => {
                    delete instance._delayInformTimer;
                    if (instance._clientUpdates.length>0) {
                        inform(false);
                    }
                }, instance.SEQUENTIAL_CLIENT_UPDATE_IMMEDIATE);
                inform(false);
            }
        }
        if (instance.SEQUENTIAL_CLIENT_UPDATE_DELAY) {
            instance._clientUpdatesDelayed.push(payload);
            if (instance._delayInformTimerDelayed) {
                instance._delayInformTimerDelayed.cancel();
            }
            instance._delayInformTimerDelayed = later(() => {
                delete instance._delayInformTimerDelayed;
                if (instance._clientUpdatesDelayed.length>0) {
                    inform(true);
                }
            }, instance.SEQUENTIAL_CLIENT_UPDATE_DELAY);
        }
    },

    /**
     * Sets up a listener to `connection` --> for every new connection to the socketserver.
     * Will store the connection in an internal Map and also removes it when the connection gets lost.
     *
     * @method setupConnectionListeners
     * @since 2.0.0
     */
    setupConnectionListeners() {
        const instance = this;
        instance.socketIO.on('connection', function(socket) {
            socket.on('clientconnected', data => {
                // a client sends its props: ignore anything else, a bad message must not crash the process
                const appProps = data && data.props && data.props.__appProps;
                if (!appProps) {
                    return;
                }
                instance.socketConnections.set(socket, data);
                // if the client has a different version, then send a signal to refresh the page
                if (appProps.serverStartup!==instance._serverStartupTime) {
                    // inform the client to relaod the page
                    socket.emit('versionchanged');
                }
            });
            // enable to listen for other connection for whatever purpose in the apps:
            socket.on('otherconnected', data => {
                Event.emit('socketserver:otherconnected', {
                    socket: socket,
                    data: data
                });
            });
            socket.on('disconnect', () => instance.socketConnections.delete(socket));
        });
    },

    /**
     * Listens for `socketserver:syncclients` events.
     * which will then invoke `updateAllClients`
     *
     * @method setupEventListener
     * @since 2.0.0
     */
    setupEventListener() {
        const instance = this;
        Event.defineEvent('socketserver:syncclients')
            .defaultFn(instance.updateAllClients.bind(instance));
    },

    /**
     * Removes the `connection`-listener on destruction.
     *
     * @method destroy
     * @since 2.0.0
     */
    destroy() {
        Event.undefEvent('socketserver:syncclients');
        this.socketIO.removeListener('connection');
    }
});

module.exports = {
    start(config) {
        if (!socketServerInstance) {
            socketServerInstance = new SocketServer(config);
        }
    },

    stop() {
        if (socketServerInstance) {
            socketServerInstance.destroy();
            socketServerInstance = null;
        }
    },

    getSocketServer() {
        return socketServerInstance;
    }
};
