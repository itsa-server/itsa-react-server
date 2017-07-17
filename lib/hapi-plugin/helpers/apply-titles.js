/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

/* eslint no-empty: 0*/
'use strict';

const titlesDir = process.cwd()+'/src/pagetitles/',
    fs = require('fs-extra');

const generate = async (appTitles, languages) => {
    const langKeys = Object.keys(languages);
    // await does not `wait` within Array.forEach, but it does wait with usage of `for of`:
    for (let lang of langKeys) {
        let titles, keys;
        if (languages[lang]!==false) {
            try {
                titles = await fs.readJson(titlesDir+lang+'.json', {throws: false});
                keys = Object.keys(titles);
                keys.forEach(key => {
                    appTitles[key] || (appTitles[key]={});
                    appTitles[key][lang] = titles[key];
                });
            }
            catch (err) {}
        }
    }
};

module.exports = {
    generate
};
