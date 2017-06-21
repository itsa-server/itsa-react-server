/* eslint no-console: 0*/

'use strict';

require('itsa-jsext');

const fs = require('fs-extra'),
    cwd = process.cwd(),
    path = require('path'),
    childProcess = require('child_process'),
    logUpdate = require('log-update'),
    killProcess = require('../kill-process'),
    cssVersionedExternals = require('../find-css-versioned-externals')(),
    jsVersionedExternals = require('../find-js-versioned-externals')(),
    later = require('itsa-utils').later,
    findPackageVersion = require('../find-package-version'),
    PREBOOT_CAPTURE = 'preboot/__dist/preboot_browser.min.js',
    BABEL_POLYFILL = 'babel-polyfill/dist/polyfill.min.js',
    frames = ['|', '/', '-', '\\'];

const buildWebpackOneFile = (configFile, sourceMaps) => {
    let child, promise;
    promise = new Promise((fulfill, reject) => {
        // prevent `stdout maxBuffer exceeded` : http://stackoverflow.com/questions/23429499/stdout-buffer-issue-using-node-child-process
        if (!sourceMaps) {
            configFile = './node_modules/itsa-react-server/lib/webpack/nosourcemaps.'+configFile;
        }
        // see https://nodejs.org/api/child_process.html#child_process_options_stdio:
        child = childProcess.spawn(cwd+'/node_modules/.bin/webpack', ['--config', configFile], { stdio: [0,1,2] });
        // child = childProcess.spawn(cwd+'/node_modules/.bin/webpack', ['config '+configFile], {maxBuffer: 1024 * 1024 * 50});
        child.on('exit', function(data) {
            if (data) {
                reject();
            }
            else {
                fulfill();
            }
        });
    });
    return {
        child,
        promise
    };
};

const buildWebpackConfigurations = sourceMaps => {
    let build1 = buildWebpackOneFile('webpack.config.chunks.js', sourceMaps),
        build2 = buildWebpackOneFile('webpack.config.views.js', sourceMaps),
        promises = Promise.all([
            build1.promise,
            build2.promise
        ]);
    return {
        childProcesses: [
            build1.child,
            build2.child
        ],
        promises
    };
};

const copyAssets = packageVersion => {
    const srcDir = cwd+'/src/assets',
        destDir = cwd+'/build.tmp/public/assets/'+packageVersion;
    return fs.readdir(srcDir)
        .then(items => items.filter(item => (item!=='css')))
        .then(items => Promise.all(items.map(file => fs.copy(srcDir+'/'+file, destDir+'/'+file))));
};

const copyAssetsPrivate = packageVersion => {
    const srcDir = cwd+'/src/assets-private',
        destDir = cwd+'/build.tmp/private/assets-private/'+packageVersion;
    return fs.copy(srcDir, destDir);
};

const copyExternalCssPackages = () => {
    let list = [];
    cssVersionedExternals.forEach(item => list.push(fs.copy(path.resolve(cwd, 'node_modules', item.module), path.resolve(cwd, 'build.tmp/public/assets/_itsa_server_external_modules/'+item.version+'/', item.module))));
    return Promise.resolve(list);
};

const copyExternalJsPackages = () => {
    let list = [];
    const copyPackage = item => {
        const dest = path.resolve(cwd, 'build.tmp/public/assets/_itsa_server_external_modules/'+item.version+'/', item.module),
            source1 = path.resolve(cwd, 'node_modules', item.module),
            source2 = path.resolve(cwd, 'externals', item.module);
        return fs.copy(source1, dest)
            .catch(() => fs.copy(source2, dest))
            .catch(() => console.warn('module', item.module, 'not found'));
    };
    jsVersionedExternals.forEach(item => list.push(copyPackage(item)));
    // also copy preboot:
    list.push(fs.copy(path.resolve(cwd, 'node_modules/'+PREBOOT_CAPTURE), path.resolve(cwd, 'build.tmp/public/assets/_itsa_server_external_modules/'+findPackageVersion.getVersion(PREBOOT_CAPTURE)+'/'+PREBOOT_CAPTURE)));
    // also copy babel-polyfill:
    list.push(fs.copy(path.resolve(cwd, 'node_modules/'+BABEL_POLYFILL), path.resolve(cwd, 'build.tmp/public/assets/_itsa_server_external_modules/'+findPackageVersion.getVersion(BABEL_POLYFILL)+'/'+BABEL_POLYFILL)));
    return Promise.itsa_finishAll(list);
};

const moveCommonCss = (packageVersion, sourceMaps) => {
    return fs.readJson(cwd+'/build.tmp/build-stats.json')
        .then(buildstats => {
            let commonItem, list;
            if (Array.isArray(buildstats)) {
                commonItem = buildstats.find(item => item.isCommon);
                if (commonItem && commonItem.cssfile) {
                    list = [
                        fs.move(cwd+'/build.tmp/private/assets/css/'+commonItem.cssfile, cwd+'/build.tmp/public/assets/'+packageVersion+'/_itsa_server_commons/'+commonItem.cssfile, {overwrite: true})
                    ];
                    if (sourceMaps) {
                        list.push(fs.move(cwd+'/build.tmp/private/assets/css/'+commonItem.cssfile+'.map', cwd+'/build.tmp/public/assets/'+packageVersion+'/_itsa_server_commons/'+commonItem.cssfile+'.map', {overwrite: true}));
                    }
                    return Promise.all(list);
                }
            }
        });
};

const buildWebpack = (environment, processtime, sourceMaps) => {
    const starttime = Date.now() - (processtime || 0);
    let cancelled = false,
        i = 0,
        promise, buildWebpackConfigs, killProcessPromise1, elapsed,
        killProcessPromise2, timer, packageVersion;

    logUpdate('webpack '+frames[0]);

    timer = later(() => {
        const frame = frames[i = ++i % frames.length];
        logUpdate('webpack '+frame);
    }, 100, true);

    promise = new Promise(async(resolve, reject) => {
        try {
            if (environment==='production') { // in case of non production, emptying the build dir is done by the watcher
                await fs.emptyDir(cwd+'/build.tmp');
            }
            if (!cancelled) {
                buildWebpackConfigs = buildWebpackConfigurations(sourceMaps);
                await buildWebpackConfigs.promises;
                buildWebpackConfigs = null; // prevent cancelling
            }
            cancelled || (packageVersion = await findPackageVersion.getVersion());
            cancelled || (await copyAssets(packageVersion));
            cancelled || (await copyAssetsPrivate(packageVersion));
            cancelled || (await copyExternalCssPackages());
            cancelled || (await copyExternalJsPackages());
            cancelled || (await moveCommonCss(packageVersion, sourceMaps));

            timer.cancel();
            if (!cancelled) {
                await fs.move(cwd+'/build.tmp', cwd+'/build', {overwrite: true});
                elapsed = Date.now() - starttime;
                logUpdate('build finished in '+Math.round((elapsed/1000))+' seconds');
                logUpdate.done();
                resolve(elapsed);
            }
            else {
                logUpdate('build cancelled');
                logUpdate.done();
                await Promise.all([
                    killProcessPromise1,
                    killProcessPromise2
                ]);
                await fs.remove(cwd+'/build.tmp');
                resolve(false); // return `false` which identifies that the process is cancelled
            }
        }
        catch (err) {
            buildWebpackConfigs = null; // prevent cancelling
            await fs.remove(cwd+'/build.tmp');
            timer.cancel();
            logUpdate('process error');
            logUpdate.done();
            reject(err);
        }
    });

    return {
        cancel() {
            cancelled = true;
            if (buildWebpackConfigs) {
                // kill child processes
                killProcessPromise1 = Promise.itsa_manage();
                killProcessPromise2 = Promise.itsa_manage();
                buildWebpackConfigs.childProcesses.forEach((childProcess, i) => {
                    killProcess(childProcess.pid, true, null, () => {
                        if (i===0) {
                            killProcessPromise1.fulfill();
                        }
                        else {
                            killProcessPromise2.fulfill();
                        }
                    });
                });
            }
            else {
                killProcessPromise1 = Promise.resolve();
                killProcessPromise2 = Promise.resolve();
            }
            return promise;
        },
        finished: promise
    };
};

module.exports = buildWebpack;
