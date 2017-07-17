/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

const cwd = process.cwd(),
    Path = require('path'),
    fs = require('fs-extra');

const FsLanguageFiles = {
    async readFile(language) {
        let filecontent, translations;
        language || (language='en');
        try {
            filecontent = await fs.readFile(Path.resolve(cwd, 'src/languages', language+'.json'), 'utf8');
            translations = JSON.parse(filecontent);
        }
        catch (err) {
            console.warn(err);
            translations = {};
        }
        return translations;
    }
};

module.exports = FsLanguageFiles;
