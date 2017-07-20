/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

/* eslint no-console:0 */

const idGenerator = require('itsa-utils').idGenerator;

const create = debugEnabled => {
    // define console.debug, ALWAYS make available to use:
    console.debug = function() {
        if (debugEnabled) {
            if (arguments[0] && arguments[0]._itsa_identifier) {
                // revert first argument from `request` into its request-identifier, which is set by ../plugin.js
                arguments[0] = arguments[0]._itsa_identifier;
            }
            console.log.apply(null, arguments);
        }
    };
};

const logRequests = server => {
    server.root.ext('onRequest', function(request, reply) {
        let args = [];
        const method = request.method.toUpperCase();
        request['_itsa_identifier'] = idGenerator('request');
        args.push(request);
        args.push(method);
        args.push(request.path);
        args.push('query:');
        args.push(request.query);
        // CANNOT set `params` and `payload` --> they are not defined at this stage
        // args.push('params:');
        // args.push(request.params);
        // args.push('payload:');
        // args.push(request.payload);
        args.push('from');
        args.push(request.info.remoteAddress);
        args.push(request.headers['user-agent']);
        // empty line to make a clear distinguish between requests
        console.debug('');
        // devide line to make a clear distinguish between requests:
        console.debug('*********************************************************************************************************************');
        console.debug.apply(null, args);
        return reply.continue();
    });
};

module.exports = {
    create,
    logRequests
};
