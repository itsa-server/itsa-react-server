/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

require('itsa-jsext');

const reload = require('require-reload')(require); // see https://github.com/fastest963/require-reload

module.exports = (extraExternals, searchAllFilenames) => {
    let manifest = reload('./load-manifest'),
        externals = {},
        jsList;

    const addToMap = rule => {
        if (!externals[rule.module]) {
            externals[rule.module] = searchAllFilenames ? rule.file : rule.ref;
        }
    };

    const addManifestToMap = manifestExternalModules => {
        if (manifestExternalModules) {
            jsList = manifestExternalModules.filter(rule => Object.itsa_isObject(rule));
            jsList.forEach(addToMap);
        }
    };

    addManifestToMap(manifest['external-modules']);
    // in case of `searchAllFilenames`, we are also interested in the manifestfiles of the other environments:
    if (searchAllFilenames && Object.itsa_isObject(manifest.environments)) {
        manifest.environments.itsa_each((environmentManifest, key) => {
            // rename environmentManifest.item.module to ensure that the keys are unique:
            if (Array.isArray(environmentManifest['external-modules'])) {
                environmentManifest['external-modules'].forEach(item => item.module += '_'+key);
                addManifestToMap(environmentManifest['external-modules']);
            }
        });
    }

    if (Array.isArray(extraExternals)) {
        extraExternals.forEach(addToMap);
    }
    return externals;
};
