'use strict';

const cwd = process.cwd(),
    fs = require('fs-extra'),
    Path = require('path'),
    BABEL_POLYFILL = 'babel-polyfill/dist/polyfill.min.js',
    PREBOOT_CAPTURE = 'preboot/__dist/preboot_browser.min.js',
    findPackageVersion = require('../../find-package-version');

let GLOBAL_ASSETS = {
    JS: {},
    CSS: {},
    INLINECSS: {}
};

const merge = async (context, affinityView, viewComponentCommon, viewComponentNrs, appConfig) => {
    const prefix = cwd+'/build/';
    let promises, response;

    const getCommonCss = async () => {
        let filename, returnData;
        if (GLOBAL_ASSETS.COMMONCSS!==undefined) {
            returnData = GLOBAL_ASSETS.COMMONCSS;
        }
        else {
            if (appConfig.cdn) {
                GLOBAL_ASSETS.COMMONCSS = appConfig.cdn+'assets/'+appConfig.packageVersion+'/_itsa_server_commons/'+viewComponentCommon.cssfile;
                returnData = GLOBAL_ASSETS.COMMONCSS;
            }
            else {
                // use local file
                // not yet looked up: search on the disk
                // not yet looked up: search on the disk
                // first, we need to find the right reference
                filename = prefix+'public/assets/'+appConfig.packageVersion+'/_itsa_server_commons/'+viewComponentCommon.cssfile;
                try {
                    await fs.stat(filename); // fails if there is not such a file
                    GLOBAL_ASSETS.COMMONCSS = '/assets/'+appConfig.packageVersion+'/_itsa_server_commons/'+viewComponentCommon.cssfile;
                    returnData =  GLOBAL_ASSETS.COMMONCSS;
                }
                catch (err) {
                    GLOBAL_ASSETS.COMMONCSS = '';
                    returnData = '';
                }
            }
        }
        return returnData;
    };

    const getPageCss = async () => {
        let filename, returnData;
        if (GLOBAL_ASSETS.CSS[affinityView]!==undefined) {
            returnData = {
                link: GLOBAL_ASSETS.CSS[affinityView],
                inline: GLOBAL_ASSETS.INLINECSS[affinityView]
            };
        }
        else {
            try {
                // not yet looked up: search on the disk
                filename = prefix+'private/assets/css/'+viewComponentNrs[affinityView].cssfile;
                await fs.stat(filename); // fails if there is not such a file
                GLOBAL_ASSETS.CSS[affinityView] = '/assets/local/css/'+viewComponentNrs[affinityView].cssfile;
                appConfig['inline-pagecss'] && (GLOBAL_ASSETS.INLINECSS[affinityView]=fs.readFileSync(filename, 'utf8'));
                returnData = {
                    link: GLOBAL_ASSETS.CSS[affinityView],
                    inline: GLOBAL_ASSETS.INLINECSS[affinityView]
                };
            }
            catch (err) {
                GLOBAL_ASSETS.CSS[affinityView] = '';
                GLOBAL_ASSETS.INLINECSS[affinityView] = '';
                returnData = {};
            }
        }
        return returnData;
    };

    const getPageScript = async () => {
        let filename, returnData;
        if (GLOBAL_ASSETS.JS[affinityView]!==undefined) {
            returnData = GLOBAL_ASSETS.JS[affinityView];
        }
        else {
            try {
                // not yet looked up: search on the disk
                filename = prefix+'private/assets/js/'+viewComponentNrs[affinityView].hash+'.js';
                await fs.stat(filename); // fails if there is not such a file
                GLOBAL_ASSETS.JS[affinityView] = '/assets/local/js/'+viewComponentNrs[affinityView].hash+'.js';
                returnData = GLOBAL_ASSETS.JS[affinityView];
            }
            catch (err) {
                GLOBAL_ASSETS.JS[affinityView] = '';
                returnData = '';
            }
        }
        return returnData;
    };

    const getCommonScript = async () => {
        let filename, returnData;
        if (GLOBAL_ASSETS.COMMONJS!==undefined) {
            returnData = GLOBAL_ASSETS.COMMONJS;
        }
        else {
            try {
                // if on cdn then use that file:
                if (appConfig.cdn) {
                    GLOBAL_ASSETS.COMMONJS = appConfig.cdn+'assets/'+appConfig.packageVersion+'/_itsa_server_commons/'+viewComponentCommon.hash+'.js';
                }
                else {
                    // use local file
                    // not yet looked up: search on the disk
                    filename = prefix+'public/assets/'+appConfig.packageVersion+'/_itsa_server_commons/'+viewComponentCommon.hash+'.js';
                    await fs.stat(filename); // fails if there is not such a file
                    GLOBAL_ASSETS.COMMONJS = '/assets/'+appConfig.packageVersion+'/_itsa_server_commons/'+viewComponentCommon.hash+'.js';
                }
                returnData = GLOBAL_ASSETS.COMMONJS;
            }
            catch (err) {
                GLOBAL_ASSETS.COMMONJS = '';
                returnData = '';
            }
        }
        return returnData;
    };

    const getServiceWorkerScript = () => {
        if (GLOBAL_ASSETS.SERVICEWORKER===undefined) {
            GLOBAL_ASSETS.SERVICEWORKER = {__html: "'use strict';if('serviceWorker' in navigator){navigator.serviceWorker.register('_itsa_server_serviceworker.js')}"};
        }
        return GLOBAL_ASSETS.SERVICEWORKER;
    };

    promises = [
        getCommonCss(),
        getPageCss(),
        getPageScript(),
        getCommonScript()
    ];

    try {
        response = await Promise.all(promises);
        context.__appProps.itsa_merge({
            itsacommonlinkcss: response[0],
            itsapagelinkcss: appConfig['inline-pagecss'] ? null : response[1].link,
            itsapageinlinecss: appConfig['inline-pagecss'] && {__html: response[1].inline},
            itsapagescript: response[2],
            itsacommonscript: response[3]
        }, {force: 'deep'});
    }
    catch (err) {
        console.error(err);
    }
    if (appConfig['service-workers']) {
        context.__appProps.itsaserviceworkerscript = getServiceWorkerScript();
    }
    if (appConfig['babel-polyfill']) {
        context.__appProps.itsapolyfilles6script = (appConfig.cdn ?
            appConfig.cdn+'assets/_itsa_server_external_modules/'+findPackageVersion.getVersion(BABEL_POLYFILL)+'/' :
            (Path.resolve('/assets/_itsa_server_external_modules/'+findPackageVersion.getVersion(BABEL_POLYFILL))+'/')) + BABEL_POLYFILL;
    }
    context.__appProps.itsaprebootcapturescript = (appConfig.cdn ?
        appConfig.cdn+'assets/_itsa_server_external_modules/'+findPackageVersion.getVersion(PREBOOT_CAPTURE)+'/' :
        (Path.resolve('/assets/_itsa_server_external_modules/'+findPackageVersion.getVersion(PREBOOT_CAPTURE))+'/')) + PREBOOT_CAPTURE;
};

module.exports = {
    merge
};
