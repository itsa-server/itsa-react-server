const notify = require('node-notify');

const shutdown = async(server, gracefullyShutDown, production) => {
    await server.stop({timeout: gracefullyShutDown * 1000});
    if (!production) {
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
