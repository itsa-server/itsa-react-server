/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

let CACHED_FILE_CONTENTS = {},
    fs = require('fs-extra');

const readFile = async file => {
    let data;
    if (!CACHED_FILE_CONTENTS[file]) {
        try {
            data = await fs.readFile(file, 'utf8');
        }
        catch (err) {
            data = '';
        }
        CACHED_FILE_CONTENTS[file] = data;
    }
    return CACHED_FILE_CONTENTS[file];
};

module.exports = {
    readFile
};
