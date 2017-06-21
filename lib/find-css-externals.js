'use strict';

const reload = require('require-reload')(require), // see https://github.com/fastest963/require-reload
    cwd = process.cwd(),
    path = require('path');

module.exports = () => {
    let manifest = reload(path.resolve(cwd, 'src/manifest.json'));
    if (!manifest['external-modules']) {
        manifest['external-modules'] = [];
    }
    return manifest['external-modules'].filter(rule => (typeof rule==='string') && (/\.s?css$/i).test(rule));
};
