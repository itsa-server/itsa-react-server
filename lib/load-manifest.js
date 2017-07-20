/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

require('itsa-jsext');

const reload = require('require-reload')(require), // see https://github.com/fastest963/require-reload
    defaultManifest = require('./default-manifest.json'),
    projectManifest = reload(process.cwd()+'/src/manifest.json');

module.exports = defaultManifest.itsa_merge(projectManifest, {force: 'deep'});
