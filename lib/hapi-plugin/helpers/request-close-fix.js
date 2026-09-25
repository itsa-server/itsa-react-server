/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 17.1.0
*/

'use strict';

// Node >= 16 emits the request's 'close' event once the body has been read; the event is held
// until the response has closed, so hapi 16's listeners (request.js, transmit.js) and the app's
// only see it when the exchange is over - as a disconnect if the response had not finished.
// see https://github.com/hapijs/hapi/issues/4298

const NODE_MAJOR = parseInt(process.versions.node.split('.')[0], 10);

const apply = server => {
    if (NODE_MAJOR<16) {
        return;
    }
    server.ext('onRequest', (request, reply) => {
        const req = request.raw.req,
            res = request.raw.res,
            emit = req.emit;
        let closeHeld = false,
            responseClosed = false;
        req.emit = function(event) {
            if ((event==='close') && !responseClosed) {
                closeHeld = true;
                return false;
            }
            return emit.apply(this, arguments);
        };
        res.once('close', () => {
            responseClosed = true;
            if (closeHeld) {
                emit.call(req, 'close');
            }
        });
        return reply.continue();
    });
};

module.exports = {
    apply
};
