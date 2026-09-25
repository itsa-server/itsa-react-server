/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

/* eslint no-empty: 0*/

// package.json is read with fs, not with require(): getVersion() runs on every page render, and
// require-reload left a new Module in this module's `children` on every call (a memory leak)
const fs = require('fs'),
    cwd = process.cwd(),
    path = require('path'),
    BOM = /^\uFEFF/;

// the parsed package.json, or undefined when the file is missing or unreadable
const readPackage = file => {
    let packageInfo;
    try {
        packageInfo = JSON.parse(fs.readFileSync(file, 'utf8').replace(BOM, ''));
    }
    catch (err) {}
    return packageInfo;
};

const getVersion = module => {
    let nodedir, externalsdir, packageInfo, indexSlash;
    if (!module) {
        // take main app
        module = '';
        nodedir = '';
    }
    else {
        indexSlash = module.indexOf('/');
        if (indexSlash!==-1) {
            module = module.substr(0, indexSlash);
        }
        nodedir = 'node_modules';
        externalsdir = 'externals';
    }
    packageInfo = readPackage(path.resolve(cwd, nodedir, module, 'package.json'));
    if (!packageInfo && externalsdir) {
        // file not found -> try `externals`
        packageInfo = readPackage(path.resolve(cwd, externalsdir, module, 'package.json'));
    }
    if (!packageInfo) {
        console.warn('Package', module, 'seems not to be installed');
        packageInfo = {
            version: '0.0.1'
        };
    }
    return packageInfo.version;
};

module.exports = {
    getVersion
};
