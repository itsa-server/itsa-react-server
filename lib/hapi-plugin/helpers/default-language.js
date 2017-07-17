/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

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
