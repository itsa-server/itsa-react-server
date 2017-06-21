/* eslint no-console: 0*/

'use strict';

require('itsa-jsext');

const fs = require('fs-extra'),
    cwd = process.cwd(),
    childProcess = require('child_process'),
    logUpdate = require('log-update'),
    killProcess = require('../kill-process'),
    later = require('itsa-utils').later,
    frames = ['|', '/', '-', '\\'];

const lint = () => {
    let child, promise;
    promise = new Promise((fulfill, reject) => {
        child = childProcess.spawn(cwd+'/node_modules/.bin/eslint', [cwd+'/src/**/*.{js,jsx}'], { stdio: [0,1,2] });
        child.on('exit', function(data){
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

const lintSourcefiles = restart => {
    const starttime = Date.now();
    let cancelled = false,
        i = 0,
        lintProcess, lintResult, elapsed, timer, promise, killProcessPromise;

    console.log(restart ? 'build restarted' : 'build started');
    logUpdate('linting '+frames[0]);

    timer = later(() => {
        const frame = frames[i = ++i % frames.length];
        logUpdate('linting '+frame);
    }, 100, true);

    promise = new Promise(async(resolve, reject) => {
        try {
            await fs.emptyDir(cwd+'/build.tmp');
            if (!cancelled) {
                lintProcess = lint();
                lintResult = await lintProcess.promise;
                console.log(lintResult);
            }

            timer.cancel();
            if (!cancelled) {
                elapsed = Date.now() - starttime;
                logUpdate('linting done!');
                logUpdate.done();
                resolve(elapsed);
            }
            else {
                logUpdate('build cancelled');
                logUpdate.done();
                return killProcessPromise.then(() => resolve(false)); // return `false` which identifies that the process is cancelled
            }
        }
        catch (err) {
            console.warn('LINT ERROR');
            lintProcess = null; // prevent cancelling
            timer.cancel();
            logUpdate('process error');
            logUpdate.done();
            reject(err);
        }
    });

    return {
        cancel() {
            cancelled = true;
            if (lintProcess) {
                // kill child process
                killProcessPromise = Promise.itsa_manage();
                killProcess(lintProcess.child.pid, true, null, () => {
                    killProcessPromise.fulfill();
                });
            }
            else {
                killProcessPromise = Promise.resolve();
            }
            return promise;
        },
        finished: promise
    };
};

module.exports = lintSourcefiles;
