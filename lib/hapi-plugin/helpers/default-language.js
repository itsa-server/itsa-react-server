'use strict';

const generate = async appConfig => {
    let firstLang;
    if (typeof appConfig.languages !== 'object') {
        appConfig.languages = {
            en: 'default'
        };
    }
    for (let key in appConfig.languages) {
        (appConfig.languages[key]==='default') && (appConfig.defaultLanguage=key);
        if (appConfig.defaultLanguage) {
            break;
        }
        firstLang || (firstLang=key);
    }
    appConfig.defaultLanguage || (appConfig.defaultLanguage=(firstLang || 'en'));
};

module.exports = {
    generate
};
