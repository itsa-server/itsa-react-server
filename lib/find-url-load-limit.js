/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

const reload = require('require-reload')(require), // see https://github.com/fastest963/require-reload
    path = require('path');

module.exports = () => {
    let manifest = reload('./load-manifest');
    return manifest['url-loader-limit'];
};
