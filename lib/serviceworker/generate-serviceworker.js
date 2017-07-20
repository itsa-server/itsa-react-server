/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

let serviceWorkerTemplate;

const fs = require('fs-extra'),
    cwd = process.cwd();

const generateFile = async (version, urlsToCache, offlineImage, offlinePage, socketPort, cdnUrl) => {
    if (!urlsToCache) {
        urlsToCache = [];
    }
    else if (typeof urlsToCache==='string') {
        urlsToCache = [urlsToCache];
    }
    if (!serviceWorkerTemplate) {
        serviceWorkerTemplate = await fs.readFile(cwd+'/node_modules/itsa-react-server/lib/serviceworker/serviceworker.min.js', 'utf8');
    }
    return serviceWorkerTemplate.replace('(autoparams)', '(self,\''+version+'\','+JSON.stringify(urlsToCache)+',\''+offlineImage+'\',\''+offlinePage+'\',\''+socketPort+'\','+(cdnUrl ? '\''+cdnUrl+'\'' : '\'\'')+')');
};

module.exports = {
    generateFile
};
