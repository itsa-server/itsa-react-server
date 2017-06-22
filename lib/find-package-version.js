/* eslint no-empty: 0*/

const reload = require('require-reload')(require), // see https://github.com/fastest963/require-reload
    cwd = process.cwd(),
    path = require('path');

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
    try {
        packageInfo = reload(path.resolve(cwd, nodedir, module, 'package.json'));
    }
    catch (err) {
        // file not found -> try `externals`
        if (externalsdir) {
            try {
                packageInfo = reload(path.resolve(cwd, externalsdir, module, 'package.json'));
            }
            catch (err) {}
        }
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
