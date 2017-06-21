'use strict';

const reload = require('require-reload')(require), // see https://github.com/fastest963/require-reload
    cwd = process.cwd(),
    path = require('path');

module.exports = () => {
    let manifest = reload(path.resolve(cwd, 'src/manifest.json'));
    return manifest['url-loader-limit'];
};
