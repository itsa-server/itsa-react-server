/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

require('itsa-jsext');

const cwd = process.cwd(),
    rootPath = cwd+'/src/assets/css',
    nodePath = cwd+'/node_modules',
    fs = require('fs-extra'),
    Path = require('path');

const resolver = function(fileRef, basedir) {
    let fullFileName, isUnderscoreFile, lastIndex, hasExtention, optionalFilename, underscoreFile;
    if (fileRef[0]!=='.') {
        if (fileRef.startsWith('/')) {
            fileRef = fileRef.substr(1); // making the next test easier
        }
        // if rooted as from `src/assets/css/`, `assets/css/` or `css/` then remove this part, because we will root as from src/assets/css:
        if (fileRef.startsWith('src/assets/css/')) {
            fileRef = fileRef.substr(15);
        }
        else if (fileRef.startsWith('assets/css/')) {
            fileRef = fileRef.substr(11);
        }
        if (fileRef.startsWith('css/')) {
            fileRef = fileRef.substr(4);
        }
        if (basedir.startsWith(nodePath)) {
            fullFileName = Path.join(basedir, fileRef);
        }
        else {
            fullFileName = Path.join(rootPath, fileRef);
        }
    }
    else {
        fullFileName = Path.resolve(basedir, fileRef);
    }
    // the last step: determine if the file exists in another format: f.e. `params` should resolve into `_params.scss`
    if (fs.pathExistsSync(fullFileName)) {
        return fullFileName;
    }
    // try another filename
    lastIndex = fullFileName.lastIndexOf('/');
    hasExtention = fullFileName.itsa_endsWith('.css', true) || fullFileName.itsa_endsWith('.scss', true);
    if (!hasExtention) {
        optionalFilename = fullFileName+'.scss';
        if (fs.pathExistsSync(optionalFilename)) {
            return optionalFilename;
        }
        optionalFilename = fullFileName+'.SCSS';
        if (fs.pathExistsSync(optionalFilename)) {
            return optionalFilename;
        }
        optionalFilename = fullFileName+'.css';
        if (fs.pathExistsSync(optionalFilename)) {
            return optionalFilename;
        }
        optionalFilename = fullFileName+'.CSS';
        if (fs.pathExistsSync(optionalFilename)) {
            return optionalFilename;
        }
    }
    isUnderscoreFile = (fullFileName[lastIndex+1]==='_');
    if (!isUnderscoreFile) {
        // assume the file exists in node_modules
        underscoreFile = fullFileName.substr(0, lastIndex+1)+'_'+fullFileName.substr(lastIndex+1);
        optionalFilename = underscoreFile;
        if (fs.pathExistsSync(optionalFilename)) {
            return optionalFilename;
        }
        if (!hasExtention) {
            optionalFilename = underscoreFile+'.scss';
            if (fs.pathExistsSync(optionalFilename)) {
                return optionalFilename;
            }
            optionalFilename = underscoreFile+'.SCSS';
            if (fs.pathExistsSync(optionalFilename)) {
                return optionalFilename;
            }
            optionalFilename = underscoreFile+'.css';
            if (fs.pathExistsSync(optionalFilename)) {
                return optionalFilename;
            }
            optionalFilename = underscoreFile+'.CSS';
            if (fs.pathExistsSync(optionalFilename)) {
                return optionalFilename;
            }
        }
    }
    // no valid file...
    // return the original file neverthesless, so that the right error can be shown:
    return fullFileName;
};

module.exports = resolver;
