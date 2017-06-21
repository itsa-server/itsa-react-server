'use strict';

let serviceWorkerTemplate;

const fs = require('fs-extra'),
    cwd = process.cwd();

const generateFile = async (version, urlsToCache, offlineImage, offlinePage, socketPort, cdn) => {
    if (!urlsToCache) {
        urlsToCache = [];
    }
    else if (typeof urlsToCache==='string') {
        urlsToCache = [urlsToCache];
    }
    if (!serviceWorkerTemplate) {
        serviceWorkerTemplate = await fs.readFile(cwd+'/node_modules/itsa-react-server/lib/serviceworker/serviceworker.min.js', 'utf8');
    }
    return serviceWorkerTemplate.replace('(autoparams)', '(self,\''+version+'\','+JSON.stringify(urlsToCache)+',\''+offlineImage+'\',\''+offlinePage+'\',\''+socketPort+'\','+(cdn ? '\''+cdn+'\'' : '\'\'')+')');
};

module.exports = {
    generateFile
};
