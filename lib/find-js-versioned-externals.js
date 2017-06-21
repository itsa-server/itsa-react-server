'use strict';

require('itsa-jsext');

const findJsExternals = require('./find-js-externals'),
    findPackageVersion = require('./find-package-version');

module.exports = () => {
    let externals = findJsExternals(),
        list = [];
    externals.itsa_each((ref, module) => {
        list.push({
            module,
            version: findPackageVersion.getVersion(module)
        });
    });
    return list;
};
