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

const generate = (request, reply) => {
    const cookie = request.headers['x-cookie'];
    let cookieAction, cookieProps;
    if (cookie) {
        cookieAction = request.headers['x-action'];
        if (cookieAction==='define') {
            try {
                cookieProps = JSON.parse(request.headers['x-cookieprops']);
                request[COOKIE_DEFS[cookie]]().defineProps(reply, cookieProps);
            }
            catch (err) {}
        }
        else if (cookieAction==='set') {
            try {
                cookieProps = JSON.parse(request.headers['x-cookieprops']);
                request[COOKIE_DEFS[cookie]]().setProps(reply, cookieProps);
            }
            catch (err) {}
        }
        else if (cookieAction==='delete') {
            request[COOKIE_DEFS[cookie]]().deleteProp(reply, request.headers['x-key']);
        }
        else if (cookieAction==='remove') {
            request[COOKIE_DEFS[cookie]]().removeCookie(reply);
        }
        else if (cookieAction==='ttl') {
            request[COOKIE_DEFS[cookie]]().changeTtl(reply, request.headers['x-ms']);
        }

    }
};

module.exports = {
    generate
};
