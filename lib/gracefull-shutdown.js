/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

const notify = require('node-notify');

const shutdown = async (server, gracefullyShutDown, localEnvironment) => {
    await server.stop({timeout: gracefullyShutDown * 1000});
    if (localEnvironment) {
        notify({
            title: 'Server stopped',
            message: '',
            sound: true
        });
    }
    process.exit(0);
};

module.exports = {
    shutdown
};
