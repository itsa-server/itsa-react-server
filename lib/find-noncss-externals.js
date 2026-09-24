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

const reload = require('require-reload')(require) // see https://github.com/fastest963/require-reload

module.exports = searchAllFilenames => {
    const manifest = reload('./load-manifest');
    let cssList = [];

    const addManifestToMap = manifestExternalModules => {
        let extraExternals;
        if (Array.isArray(manifestExternalModules)) {
            extraExternals = manifestExternalModules.filter(rule => (typeof rule==='string') && !rule.itsa_endsWith('.scss', true) && !rule.itsa_endsWith('.css', true));
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
