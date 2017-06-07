'use strict';

(function(args){
    let child, webpackBuild, delayTimer, scheduleTimer, restarting;

    const environment = args[2] || 'development',
        cwd = process.cwd(),
        exec = require('child_process').exec,
        notify = require('node-notify'),
        watch = require('gulp-watch'),
        Path = require('path'),
        killProcess = require('./kill-process'),
        globFiles = [Path.resolve(cwd, 'src/**/*'), Path.resolve(cwd, '*')],
        buildWebpack = require('./build-webpack'),
        later = require('itsa-utils').later,
        clear = require('clear');


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

    const restartBuildAndServer = () => {
        let promise = webpackBuild ? webpackBuild.cancel() : Promise.resolve();
        promise.itsa_finally(() => {
            if (child) {
                restarting = true;
                killProcess(child.pid, true, null, () => {
                    runServer(true);
                });
            }
            else {
                runServer(!!webpackBuild);
            }
        });
    };

    const runServer = restart => {
        clear();
        child = null;
        if (restart) {
            notify({
                title: 'Development server',
                message: 'Rebuilding web application...',
                sound: true
            });
        }
        webpackBuild = buildWebpack(environment, restart);
        webpackBuild.ready.then(cancelled => {
            if (!cancelled) {
                child = exec('node '+cwd+'/server.js '+environment);

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
                child.on('close', (data) => {
                    if (!restarting) {
                        notify({
                            title: 'Development server',
                            message: 'Server stopped',
                            sound: true
                        });
                    }
                    restarting = false;
                });
            }
        });
    };

    watch(globFiles, handleDelayedWatch)
    runServer();
}(process.argv));
