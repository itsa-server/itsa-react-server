const reload = require('require-reload')(require), // see https://github.com/fastest963/require-reload
    cwd = process.cwd(),
    path = require('path');

module.exports = extraExternals => {
    let manifest = reload(path.resolve(cwd, 'src/manifest.json')),
        jsMap = {},
        jsList, key;

    const addToMap = rule => {
        if (typeof rule==='string') {
            // only requiring module,without binding it to a variable
            // to enable it to be processed, bind it to a dummy global:
            jsMap[rule] = '_itsa_react_server_dummy_global';
        }
        else {
            key = rule.itsa_keys()[0];
            jsMap[key] = rule[key];
        }
    };

    if (!manifest['external-modules']) {
        manifest['external-modules'] = [];
    }
    jsList = manifest['external-modules'].filter(rule => typeof rule!=='string' || !(/\.s?css$/i).test(rule));

    jsList.forEach(addToMap);

    if (Array.isArray(extraExternals)) {
        extraExternals.forEach(addToMap);
    }
    return jsMap;
};
