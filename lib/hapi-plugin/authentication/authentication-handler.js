/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

const path = require('path'),
    authenticationPlugin = require('./authentication-plugin'),
    cwd = process.cwd();

module.exports = {
    register(server, authConfig, password) {
        return new Promise((fulfill, reject) => {
            server.register({
                register: authenticationPlugin,
                options: {
                    password,
                    'ttl-sec': authConfig['ttl-sec'],
                    'session-cookie': authConfig['session-cookie'],
                    onlySsl: (typeof authConfig.onlySsl==='boolean') ? authConfig.onlySsl : true // <-- force cookies to be seen over https only!!
                }
            }, err => {
                if (err) {
                    reject(err);
                }
                else {
                    // now, generate the strategies:
                    authConfig.strategies.forEach(item => {
                        let validateFunc;
                        try {
                            if (item.validateFunc) {
                                validateFunc = require(path.resolve(cwd, item.validateFunc));
                            }
                            server.root.auth.strategy(item.strategy, 'itsa-react-server-auth', {
                                validateFunc,
                                loginView: item.loginView || authConfig.loginView,
                                password
                            });
                        }
                        catch (err) {
                            console.warn(err);
                        }
                    });
                    fulfill();
                }
            });
        });
    }
};
