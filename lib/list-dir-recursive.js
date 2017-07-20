/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

const fs = require('fs-extra');

const listDir = async (objectForm, dir, rootLength) => {
    let list = [],
        stat, dirList;
    const files = await fs.readdir(dir);
    if (!rootLength) {
        rootLength = dir.length+1; // needed to distract the rootdir from the filepath
    }
    // DO NOT use Array.forEach(): https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop
    for (let file of files) {
        let publicFile;
        // no hidden files/folders
        if (file[0]!=='.') {
            file = dir + '/' + file;
            stat = await fs.stat(file);
            if (stat && stat.isDirectory()) {
                dirList = await listDir(objectForm, file, rootLength);
                Array.prototype.push.apply(list, dirList);
            }
            else {
                publicFile = file.substr(rootLength);
                list.push(objectForm ? {
                    localFile: file,
                    publicFile
                } : publicFile);
            }
        }
    }
    return list;
};

module.exports = {
    listDir: listDir.bind(null, false),
    listDirObjects: listDir.bind(null, true)
};
