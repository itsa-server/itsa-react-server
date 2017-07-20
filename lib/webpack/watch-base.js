/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

/* eslint no-console: 0*/
'use strict';

const watchBase = (sourceMaps, args) => {
    let child, webpackBuild, linting, delayTimer, scheduleTimer, restarting;

    const environment = args[2] || process.env.NODE_ENV || 'local',
        cwd = process.cwd(),
        exec = require('child_process').exec,
        notify = require('node-notify'),
        watch = require('gulp-watch'),
        killProcess = require('../kill-process'),
        globFiles = [cwd+'/*.js', cwd+'/package.json', cwd+'/src/**/*'],
        buildWebpack = require('./build-webpack'),
        lintSourcefiles = require('./lint-sourcefiles'),
        later = require('itsa-utils').later,
        clear = require('clear'),
        keypress = require('keypress');

    const handleDelayedWatch = () => {
        if (!delayTimer) {
            delayTimer = later(() => {
                delayTimer = null;
                if (scheduleTimer) {
                    scheduleTimer = false;
                    restartBuildAndServer();
                }
            }, 1000);
            restartBuildAndServer();
        }
        else {
            scheduleTimer = true;
        }
    };

    const watchKeyPress = () => {
        // see: https://www.npmjs.com/package/keypress
        // make `process.stdin` begin emitting "keypress" events
        keypress(process.stdin);
        // listen for the "keypress" event
        process.stdin.on('keypress', function(ch, key) {
            let promises;
            if (key && key.ctrl) {
                if (key.name==='c') {
                    promises = [];
                    if (webpackBuild) {
                        promises.push(webpackBuild.cancel());
                    }
                    if (linting) {
                        promises.push(linting.cancel());
                    }
                    Promise.all(promises).then(() => {
                        if (child) {
                            killProcess(child.pid, true, null, () => {
                                process.exit();
                            });
                        }
                        else {
                            process.exit();
                        }
                    }).catch(err => console.error(err));
                }
                else if (key.name==='r') {
                    handleDelayedWatch();
                }
            }
        });
        process.stdin.setRawMode(true);
        process.stdin.resume();
    };

    const restartBuildAndServer = () => {
        let promises = [];
        if (webpackBuild) {
            promises.push(webpackBuild.cancel());
        }
        if (linting) {
            promises.push(linting.cancel());
        }
        Promise.all(promises).then(() => {
            if (child) {
                restarting = true;
                runServer(true);
            }
            else {
                runServer(!!webpackBuild);
            }
        }).catch(err => console.error(err));
    };

    const doRunServer = () => {
        child = exec('node "'+cwd+'/server.js" '+environment);

        child.stdout.on('data', data => {
            console.log(data);
            notify({
                title: 'Development server',
                message: data
            });
        });
        child.stderr.on('data', data => {
            console.log(data);
            notify({
                title: 'Error on development server',
                message: data,
                sound: true
            });
        });
        child.on('close', () => {
            if (!restarting) {
                notify({
                    title: 'Development server',
                    message: 'Server stopped',
                    sound: true
                });
            }
            restarting = false;
        });
    };

    const runServer = async restart => {
        let processtime, extraMarkers;
        clear();
        if (restart) {
            notify({
                title: 'Development server',
                message: 'Rebuilding web application...',
                sound: true
            });
        }
        try {
            linting = lintSourcefiles(restart);
            processtime = await linting.finished;
            if (processtime) {
                webpackBuild = buildWebpack(environment, processtime, sourceMaps);
                processtime = await webpackBuild.finished;
                if (processtime) {
                    console.warn('********** BUILD READY **********');
                    if (child) {
                        killProcess(child.pid, true, null, () => {
                            doRunServer();
                        });
                    }
                    else {
                        doRunServer();
                    }
                }
            }
        }
        catch (err) {
            const message = restart ? 'SERVER STILL RUNNING WITH PREVIOUS BUILD' : 'SERVER WILL AUTOMATICALLY START ON ANY FILE CHANGE';
            if (err && (err.message!=='WEBPACK-ERROR')) {
                console.error(err.message || err);
            }
            extraMarkers = restart ? '' : '***';
            console.warn(extraMarkers+'******************** BUILD FAILED (SEE ABOVE) ********************'+extraMarkers);
            linting = null;
            webpackBuild = null;
            console.warn(`********** ${message} **********`);
            notify({
                title: 'Development server',
                message: restart ? 'REBUILD FAILD' : 'BUILD FAILED',
                sound: true
            });
        }
    };

    // watch for files to change:
    watch(globFiles, handleDelayedWatch);

    // watch for ctrl+r:
    watchKeyPress();

    // build an start the server:
    runServer();
};

module.exports = watchBase;
