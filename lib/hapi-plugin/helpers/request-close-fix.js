/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 17.1.0
*/

'use strict';

// Node >= 16 emits the request's 'close' event once the body has been read; hapi 16's request.js
// and transmit.js take it for a disconnect. They now detect a disconnect from the response's
// 'close' instead (before it has ended, as hapi >= 20.2.1 does), while the app and Node's stream
// utilities (stream.finished, stream.pipeline, for-await, ...) still get the request's 'close' at
// the normal time.
// see https://github.com/hapijs/hapi/issues/4298

const NODE_MAJOR = parseInt(process.versions.node.split('.')[0], 10);

const apply = server => {
    if (NODE_MAJOR<16) {
        return;
    }
    server.ext('onRequest', (request, reply) => {
        const req = request.raw.req,
            res = request.raw.res,
            emit = req.emit,
            onClose = request._onClose;
        if (typeof onClose!=='function') {
            return reply.continue();
        }
        // request.js: take a disconnect from the response instead (a 'close' before it has ended)
        req.removeListener('close', onClose);
        res.once('close', () => {
            if (!res.writableEnded) {
                onClose();
            }
        });
        // transmit.js subscribes one listener to both the request's and the response's 'close': on the
        // request's first 'close', detach it there (its response subscription still sees a disconnect)
        // and let the event through for the app and for Node's stream utilities
        req.emit = function(event) {
            if (event==='close') {
                req.emit = emit;
                res.listeners('close').forEach(listener => {
                    req.removeListener('close', listener);
                });
            }
            return emit.apply(this, arguments);
        };
        return reply.continue();
    });
};

module.exports = {
    apply
};
