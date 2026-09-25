/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

/* eslint no-empty: 0*/
'use strict';

const COOKIE_DEFS = {
    'itsa-bodydata': 'getBodyDataAttrCookie',
    'itsa-props': 'getPropsCookie',
    'itsa-notexposed': 'getNotExposedCookie'
};

const generate = (request, h) => {
    const cookie = request.headers['x-cookie'];
    let cookieAction, cookieProps, ttlSec;
    if (cookie) {
        cookieAction = request.headers['x-action'];
        if (cookieAction==='define') {
            try {
                cookieProps = JSON.parse(request.headers['x-cookieprops']);
                request[COOKIE_DEFS[cookie]]().defineProps(h, cookieProps);
            }
            catch (err) {}
        }
        else if (cookieAction==='set') {
            try {
                cookieProps = JSON.parse(request.headers['x-cookieprops']);
                request[COOKIE_DEFS[cookie]]().setProps(h, cookieProps);
            }
            catch (err) {}
        }
        else if (cookieAction==='delete') {
            request[COOKIE_DEFS[cookie]]().deleteProp(h, request.headers['x-key']);
        }
        else if (cookieAction==='remove') {
            request[COOKIE_DEFS[cookie]]().removeCookie(h);
        }
        else if (cookieAction==='ttl') {
            // the header arrives as a string; the server treats the value as seconds
            ttlSec = Number(request.headers['x-ms']);
            request[COOKIE_DEFS[cookie]]().changeTtl(h, Number.isFinite(ttlSec) ? ttlSec : undefined);
        }

    }
};

module.exports = {
    generate
};
