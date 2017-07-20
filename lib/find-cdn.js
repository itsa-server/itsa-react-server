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

const path = require('path'),
    reload = require('require-reload')(require); // see https://github.com/fastest963/require-reload

module.exports = () => {
    let manifest = reload('./load-manifest'),
        cdn = manifest.cdn,
        url;
    if (cdn && cdn.enabled) {
        url = cdn.url;
        if (url && !url.itsa_endsWith('/')) {
            url += '/';
        }
    }

    return url;
};
