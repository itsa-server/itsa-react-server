'use strict';

const findPackageVersion = require('../../find-package-version'),
    getPackageEntry = require('./get-package-entry'),
    Path = require('path');

const generate = async function(processArgs, config) {
    const arg = processArgs[2];
    let env = arg && config.environments[arg],
        environmentManifest;
    if (!env) {
        env = {};
    }
    delete env['external-modules']; // these should be used only at the top-level of config, not env, specific. Otherwise `itsa-server webpack builder` gets into trouble, for it doesn't use affinities
    delete env.cdn; // these should be used only at the top-level of config, not env, specific. Otherwise `itsa-server webpack builder` gets into trouble, for it doesn't use affinities
    environmentManifest = config.itsa_deepClone().itsa_merge(env, {force: 'deep'});
    environmentManifest.packageVersion = findPackageVersion.getVersion();
    delete environmentManifest.autoActivateRoutes;
    environmentManifest.envName = arg || 'production';
    // make sure that if `cdn` is defined, it ends with a slash:
    if (environmentManifest.cdn && !environmentManifest.cdn.endsWith('/')) {
        environmentManifest.cdn += '/';
    }
    environmentManifest['external-modules'] || (environmentManifest['external-modules']=[]);
    environmentManifest['external-css-links'] = environmentManifest['external-modules'].filter(rule => (/\.s?css$/i).test(rule))
        .map(rule => {
            const isExternal = (/\^https?:\/\//i).test(rule),
                packageVersion = isExternal || findPackageVersion.getVersion(rule) || environmentManifest.packageVersion;
            return isExternal ?
                rule :
                (environmentManifest.cdn ? environmentManifest.cdn+'assets/_itsa_server_external_modules/'+packageVersion+'/' : (Path.resolve('/assets/_itsa_server_external_modules/'+packageVersion)+'/'))+rule;
        });
    environmentManifest['external-js-links'] = environmentManifest['external-modules'].filter(rule => !(/\.s?css$/i).test(rule))
        .map(rule => {
            const isExternal = (/\^https?:\/\//i).test(rule);
            let packageVersion;
            if (Object.itsa_isObject(rule)) {
                rule = rule.itsa_keys()[0];
            }
            if (!isExternal) {
                packageVersion = findPackageVersion.getVersion(rule) || environmentManifest.packageVersion;
            }
            return isExternal ?
                rule :
                (environmentManifest.cdn ? environmentManifest.cdn+'assets/_itsa_server_external_modules/'+packageVersion+'/' :
                    (Path.resolve('/assets/_itsa_server_external_modules/'+packageVersion)+'/'))+getPackageEntry.getMainFile(rule);
        });
    return environmentManifest;
};

module.exports = {
    generate
};
