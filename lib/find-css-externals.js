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

module.exports = searchAllFilenames => {
    const manifest = reload('./load-manifest');
    let cssList = [];

    const addManifestToMap = manifestExternalModules => {
        let extraExternals;
        if (Array.isArray(manifestExternalModules)) {
            extraExternals = manifestExternalModules.filter(rule => (typeof rule==='string') && (/\.s?css$/i).test(rule));
            Array.prototype.push.apply(cssList, extraExternals);
        }
    };

    addManifestToMap(manifest['external-modules']);
    // in case of `searchAllFilenames`, we are also interested in the manifestfiles of the other environments:
    if (searchAllFilenames && Object.itsa_isObject(manifest.environments)) {
        manifest.environments.itsa_each(environmentManifest => addManifestToMap(environmentManifest['external-modules']));
    }
    return cssList;
};
