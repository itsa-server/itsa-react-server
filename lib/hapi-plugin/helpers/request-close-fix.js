/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 17.1.0
*/

'use strict';

// hapi 16 takes the request's 'close' event for a client disconnect. Since Node 16 that event also
// fires once the request body has been read, so hapi 16 dropped every request with a payload (POST,
// PUT, ...) without answering it. On those Node versions a disconnect is detected from the response
// instead, the way hapi >= 20.2.1 does it: a 'close' before the response has ended.
// see https://github.com/hapijs/hapi/issues/4298

const NODE_MAJOR = parseInt(process.versions.node.split('.')[0], 10);

const apply = server => {
    if (NODE_MAJOR<16) {
        return;
    }
    server.ext('onRequest', (request, reply) => {
        const raw = request.raw;
        if (typeof request._onClose==='function') {
            raw.req.removeListener('close', request._onClose);
            // hapi/lib/transmit.js also subscribes to the request's 'close' event (a second, later
            // subscription, made when the response starts streaming) to bail out mid-stream on a
            // disconnect. On Node >= 16 that event is no longer a disconnect signal, so any further
            // 'close' subscription on the request is swallowed too; the response's 'close' below is
            // the only disconnect signal from here on.
            const originalOnce = raw.req.once.bind(raw.req);
            raw.req.once = (event, listener) => ((event==='close') ? raw.req : originalOnce(event, listener));
            raw.res.once('close', () => {
                if (!raw.res.writableEnded) {
                    request._onClose();
                }
            });
        }
        return reply.continue();
    });
};

module.exports = {
    apply
};
