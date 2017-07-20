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

const findPackageVersion = require('../../find-package-version'),
    getPackageEntry = require('./get-package-entry'),
    Path = require('path');

const generate = function(environment, fullManifest) {
    let env = fullManifest.environments[environment] || {},
        environmentManifest;
    environmentManifest = fullManifest.itsa_deepClone().itsa_merge(env, {force: 'deep'});
    environmentManifest.packageVersion = findPackageVersion.getVersion();
    delete environmentManifest.autoActivateRoutes;
    environmentManifest.envName = environment;
    // make sure that if `cdn` is defined, it ends with a slash:
    if (environmentManifest.cdn && environmentManifest.cdn.enabled && environmentManifest.cdn.url && !environmentManifest.cdn.url.endsWith('/')) {
        environmentManifest.cdn.url += '/';
    }
    environmentManifest['external-modules'] || (environmentManifest['external-modules']=[]);
    environmentManifest['external-css-links'] = environmentManifest['external-modules'].filter(rule => (/\.s?css$/i).test(rule))
        .map(rule => {
            const isExternal = (/\^https?:\/\//i).test(rule),
                packageVersion = isExternal || findPackageVersion.getVersion(rule) || environmentManifest.packageVersion;
            return isExternal ?
                rule :
                ((environmentManifest.cdn && environmentManifest.cdn.enabled) ?
                    environmentManifest.cdn.url+'assets/_itsa_server_external_modules/'+packageVersion+'/' :
                    (Path.resolve('/assets/_itsa_server_external_modules/'+packageVersion)+'/'))+rule;
        });
    environmentManifest['external-js-links'] = environmentManifest['external-modules'].filter(rule => Object.itsa_isObject(rule))
        .map(rule => {
            const file = rule.file,
                isExternal = (/\^https?:\/\//i).test(file);
            let packageVersion;
            if (!isExternal) {
                packageVersion = findPackageVersion.getVersion(file) || environmentManifest.packageVersion;
            }
            return isExternal ?
                rule :
                ((environmentManifest.cdn && environmentManifest.cdn.enabled) ?
                    environmentManifest.cdn.url+'assets/_itsa_server_external_modules/'+packageVersion+'/' :
                    (Path.resolve('/assets/_itsa_server_external_modules/'+packageVersion)+'/'))
                + getPackageEntry.getMainFile(file);
        });
    if (Array.isArray(environmentManifest.links)) {
        // replace {version} references by their values and add cdn if needed:
        environmentManifest.links.forEach(link => {
            if (typeof link.href==='string') {
                if (environmentManifest.cdn && environmentManifest.cdn.enabled) {
                    if (link.href.startsWith('/assets/')) {
                        link.href = environmentManifest.cdn.url + 'assets/' + environmentManifest.packageVersion + link.href.substr(7);
                    }
                    // also: replace all {cdn} references:
                    link.href = link.href.itsa_replaceAll('{cdn}/', '{cdn}').itsa_replaceAll('{cdn}', environmentManifest.cdn.url);
                }
                // also: replace all remaining {version} references:
                link.href = link.href.itsa_replaceAll('{version}', environmentManifest.packageVersion);
            }
        });
    }
    return environmentManifest;
};

module.exports = {
    generate
};
