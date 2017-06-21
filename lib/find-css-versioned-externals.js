'use strict';

const findCssExternals = require('./find-css-externals'),
    findPackageVersion = require('./find-package-version');

module.exports = () => {
    let externals = findCssExternals();
    return externals.map(module => {
        return {
            module,
            version: findPackageVersion.getVersion(module)
        };
    });
};
