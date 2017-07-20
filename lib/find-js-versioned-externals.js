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

const reload = require('require-reload')(require); // see https://github.com/fastest963/require-reload

module.exports = () => {
    const findJsExternals = reload('./find-js-externals'),
        findPackageVersion = reload('./find-package-version');
    let externals = findJsExternals(null, true),
        list = [];
    externals.itsa_each(filename => {
        list.push({
            filename,
            version: findPackageVersion.getVersion(filename)
        });
    });
    return list;
};
