/**
 * Setup for server-side socket-io.
 *
 * The socket-io is used to update the client whenever `this.props`
 * leads into a different view-rendering. This is monitored and managed this module
 * (by listening to rethinkdb).
 *
 * <i>Copyright (c) 2016 AcceleTrial - https://acceletrial.com</i><br>
 * Proprietary License
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
    Hapi = require('hapi'),
    Event = require('itsa-event'),
    Classes = require('itsa-classes'),
    later = require('itsa-utils').later,
    SEQUENTIAL_CLIENT_UPDATE_DELAY = 5000; // not too often: give the clients time to refresh and queue any server-changes

const SocketServer = Classes.createClass(function(config) {
    let socketPort, server;
    const instance = this;
    if (config) {
        instance.SEQUENTIAL_CLIENT_UPDATE_DELAY = SEQUENTIAL_CLIENT_UPDATE_DELAY;
        instance.server = server = new Hapi.Server();
        instance._serverStartupTime = config.serverStartupTime;
        socketPort = config.socketPort || 4002;
        server.connection({
            host: 'localhost',
            port: socketPort
        });
        instance.socketIO = SocketIO(server.listener);
        instance.socketConnections = new Map();
        instance.setupConnectionListeners();
        server.start();
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
    updateAllClients() {
        const instance = this,
            inform = () => {
                instance.socketConnections.forEach((value, socketConnection) => {
                    let actualProps = ''; // instance.server.renderPropsRenderView(value.viewName);
                    if (value.props.itsa_sameValue(value.props)) {
                        value.props = actualProps;
                        // inform the client to re-render its view
                        socketConnection.emit('propschanged');
                    }
                });
            };
        if (!instance._delayInformTimer) {
            instance._delayInformTimer = later(() => {
                delete instance._delayInformTimer;
                if (instance._scheduleupdateAllClients) {
                    delete instance._scheduleupdateAllClients;
                    inform();
                }
            }, instance.SEQUENTIAL_CLIENT_UPDATE_DELAY);
            inform();
        }
        else {
            instance._scheduleupdateAllClients = true;
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
                instance.socketConnections.set(socket, data);
                // if the client has a different version, then send a signal to refresh the page
                if (data.props.__appProps.serverStartup!==instance._serverStartupTime) {
                    // inform the client to relaod the page
                    socket.emit('versionchanged');
                }
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
