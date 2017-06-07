'use strict';

require('itsa-jsext');

const fs = require('fs-extra'),
    cwd = process.cwd(),
    childProcess = require('child_process'),
    logUpdate = require('log-update'),
    killProcess = require('./kill-process'),
    later = require('itsa-utils').later,
    frames = ['|', '/', '-', '\\'];

const buildWebpackOneFile = (configFile, production) => {
    let child, promise;
    promise = new Promise((fulfill, reject) => {
        // prevent `stdout maxBuffer exceeded` : http://stackoverflow.com/questions/23429499/stdout-buffer-issue-using-node-child-process
        let env = process.env.itsa_deepClone();
        env.NODE_ENV = production ? 'production' : 'development';
        child = childProcess.exec(cwd+'/node_modules/.bin/webpack --config '+configFile, {maxBuffer: 1024 * 1024 * 50, env}, (err, stdout, stderr) => {
            if (err && (err.signal!=='SIGKILL')) { // 'SIGKILL' occurs when the process is cancelled
                reject(err);
            }
            else {
                fulfill();
            }
        });
    });
    return {
        child,
        promise
    }
};

const buildWebpackConfigurations = production => {
    let build1 = buildWebpackOneFile('webpack.config.chunks.js', production),
        build2 = buildWebpackOneFile('webpack.config.views.js', production),
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
        }
};

const copyAssets = () => {
    const srcDir = cwd+'/src/assets',
        destDir = cwd+'/build/assets';
    return fs.readdir(srcDir)
             .then(items => items.filter(item => ((item!=='css') && (item!=='js'))))
             .then(items => Promise.all(items.map(file => fs.copy(srcDir+'/'+file, destDir+'/'+file))));
};

const buildWebpack = (environment, restart) => {
    let cancelled = false,
        i = 0,
        promise, buildWebpackConfigs, killProcessPromise1, killProcessPromise2, timer;
    const starttime = Date.now(),
        production = (environment==='production');

    console.log(restart ? 'build restarted' : 'build started');
    logUpdate('processing '+frames[0]);

    timer = later(() => {
        const frame = frames[i = ++i % frames.length];
        logUpdate('processing '+frame);
    }, 100, true);

    promise = fs.emptyDir(cwd+'/build')
                .then(() => {
                    if (!cancelled) {
                        buildWebpackConfigs = buildWebpackConfigurations(production);
                        return buildWebpackConfigs.promises;
                    }
                })
                .then(() => {
                    buildWebpackConfigs = null; // prevent cancelling
                    if (!cancelled) {
                        return copyAssets();
                    }
                })
                .then(() => {
                    let elapsed;
                    timer.cancel();
                    if (!cancelled) {
                        elapsed = Date.now() - starttime;
                        logUpdate('processed!');
                        logUpdate.done();
                        console.log('build finished in '+Math.round((elapsed/1000))+' seconds');
                    }
                    else {
                        logUpdate.clear();
                        return fs.emptyDir(cwd+'/build').then(() => {
                            return Promise.all([
                                killProcessPromise1,
                                killProcessPromise2
                            ]).then(() => true); // return `true` which identifies that the process is cancelled
                        });
                    }
                })
                .catch(err => {
                    buildWebpackConfigs = null; // prevent cancelling
                    timer.cancel();
                    logUpdate('process error');
                    logUpdate.done();
                    console.error(err);
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
        ready: promise
    }
};

module.exports = buildWebpack;
