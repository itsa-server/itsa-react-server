/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

const reload = require('require-reload')(require); // see https://github.com/fastest963/require-reload

module.exports = () => {
    const findCssExternals = reload('./find-css-externals'),
        findPackageVersion = reload('./find-package-version'),
        externals = findCssExternals(true);
    return externals.map(module => {
        return {
            module,
            version: findPackageVersion.getVersion(module)
        };
    });
};
