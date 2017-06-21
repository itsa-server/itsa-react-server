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
