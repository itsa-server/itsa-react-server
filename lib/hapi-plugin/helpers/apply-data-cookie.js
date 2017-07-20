/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

require('itsa-jsext');

const merge = async (request, props) => {
    let cookieBodyDataAttr;
    // merge '__bodyDataAttr' differently:
    // the cookie `bodyData` should be merged
    const bodyDataAttrCookie = request.getBodyDataAttrCookie();
    if (bodyDataAttrCookie) {
        cookieBodyDataAttr = bodyDataAttrCookie.getProps(request);
        if (!cookieBodyDataAttr.itsa_isEmpty()) {
            cookieBodyDataAttr.itsa_each((value, key) => {
                const cookieValue = (typeof value==='string') ? value : JSON.stringify(value);
                props.__bodyDataAttr['data-'+key] = cookieValue;
                props.__appProps.bodyattrcookie[key] = cookieValue;
            });
        }
    }
};

module.exports = {
    merge
};
