'use strict';

const cwd = process.cwd(),
    fs = require('fs-extra'),
    Path = require('path');

const getMainFile = rule => {
    const nodeDir = cwd+'/node_modules/',
        externalsDir = cwd+'/externals/';
    let mainFile;
    const getMainFile = (dir, rule) => {
        let stats, packageJson;
        stats = fs.statSync(dir+rule);
        if (stats.isDirectory()) {
            // look for package.json file
            packageJson = fs.readJsonSync(Path.resolve(dir, rule, 'package.json'));
            // check if main file exists
            if (!packageJson.main) {
                return rule + '/index.js';
            }
            try {
                mainFile = Path.join(rule, packageJson.main);
                stats = fs.statSync(Path.resolve(dir, mainFile));
                return mainFile;
            }
            catch (err) {
                return rule + '/index.js';
            }
        }
        else {
            // is a file
            return rule;
        }
    };

    // do NOT async, because this function is called within Array.map!
    // it will only be called during startup of the server, so it's not a big deal
    if (rule.endsWith('/')) {
        rule = rule.substr(0, rule.length-1);
    }
    try {
        // first search in `node_modules`
        mainFile = getMainFile(nodeDir, rule);
    }
    catch (err) {
        // when not found, then search in `externals`
        try {
            mainFile = getMainFile(externalsDir, rule);
        }
        catch (err2) {
            console.warn(err2);
            mainFile = '';
        }
    }
    return mainFile;
};

module.exports = {
    getMainFile
};
