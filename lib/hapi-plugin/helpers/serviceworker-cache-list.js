/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

const fs = require('fs-extra'),
    cwd = process.cwd(),
    Path = require('path');

const searchDir = async (baseDir, subdir) => {
    let cacheFiles = [],
        dirfiles;
    const directory = Path.join(baseDir, subdir || '');

    dirfiles = await fs.readdir(directory);
    for (let fileOrDir of dirfiles) {
        let stats, dirContent;
        if (fileOrDir[0]!=='.') {
            stats = await fs.stat(Path.join(directory, fileOrDir));
            if (stats.isFile()) {
                cacheFiles.push(Path.join('/', subdir || '', fileOrDir));
            }
            else if (stats.isDirectory()) {
                dirContent = await searchDir(baseDir, Path.join(subdir || '', fileOrDir));
                Array.prototype.push.apply(cacheFiles, dirContent);
            }
        }
    }
    return cacheFiles;
};

const generate = async (serviceWorkerCacheListViews, appConfig) => {
    let baseDir, cacheFiles, localCacheFiles, cacheFilesNoVersion, assetsVersioned, skipLength;
    try {
        baseDir = cwd+'/build/public/';
        try {
            cacheFiles = await searchDir(baseDir);
        }
        catch (err) {
            console.warn(err);
            cacheFiles = [];
        }
        // also store those that are requested without the verionnr:
        cacheFilesNoVersion = [];
        assetsVersioned = '/assets/'+appConfig.packageVersion+'/';
        skipLength = assetsVersioned.length;
        cacheFiles.forEach(item => {
            if (item.itsa_startsWith(assetsVersioned)) {
                cacheFilesNoVersion.push('/assets/'+item.substr(skipLength));
            }
        });
        // we might need to change the assets-url into a cdn-version:
        if (appConfig.cdn && appConfig.cdn.enabled) {
            cacheFiles = cacheFiles.map(item => appConfig.cdn.url+item.substr(1));
        }
        // find local assets:
        baseDir = cwd+'/build/private/assets/';
        try {
            localCacheFiles = await searchDir(baseDir);
        }
        catch (err) {
            console.warn(err);
            localCacheFiles = [];
        }
        localCacheFiles = localCacheFiles.map(file => '/assets/local'+file);
        // add the list without versionnr:
        Array.prototype.push.apply(cacheFiles, cacheFilesNoVersion);
        // add local assets:
        Array.prototype.push.apply(cacheFiles, localCacheFiles);
        // add the routes:
        Array.prototype.push.apply(cacheFiles, serviceWorkerCacheListViews);
        return cacheFiles;
    }
    catch (err) {
        console.warn(err);
        return [];
    }
};

module.exports = {
    generate
};
