/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

const reload = require('require-reload')(require), // see https://github.com/fastest963/require-reload
    cwd = process.cwd(),
    path = require('path'),
    glob = require('glob');

module.exports = () => {
    const manifest = reload('./load-manifest'),
        staticComponentFolders =  manifest['static-components-dir'] || [];

    return staticComponentFolders.reduce((prevHash, staticComponent) => {
        return glob.sync(path.join(cwd, staticComponent)+'/*.jsx').reduce((definition, file) => {
            definition[file.substring(file.lastIndexOf('/', file.lastIndexOf('/')-1)+1, file.length-4)] = file;
            return definition;
        }, prevHash);

    }, {});
};
