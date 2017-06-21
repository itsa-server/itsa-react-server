// see http://krasimirtsonev.com/blog/article/Nodejs-managing-child-processes-starting-stopping-exec-spawn#killing-stopping-the-command
/* eslint no-empty: 0*/
'use strict';

const psTree = require('ps-tree');

const killProcess = (pid, killTree, signal, callback) => {
    signal = signal || 'SIGKILL';
    callback = callback || function() {};
    if (killTree) {
        psTree(pid, function(err, children) {
            [pid].concat(
                children.map(function(p) {
                    return p.PID;
                })
            ).forEach(function(tpid) {
                try {
                    process.kill(tpid, signal);
                }
                catch (ex) {}
            });
            callback();
        });
    }
    else {
        try {
            process.kill(pid, signal);
        }
        catch (ex) { }
        callback();
    }
};

module.exports = killProcess;
