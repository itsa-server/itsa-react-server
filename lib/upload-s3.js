/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

const fs = require('fs-extra'),
    AWS = require('aws-sdk'),
    mime = require('mime');

/**
 * Uploads a file to ASW-S3.
 *
 * @method uploadFile
 * @param fullFilename {String} full filename (with absolute path) of the file that should be uploaded
 * @param filenameS3 {String} the full name of the S3-document (included the path)
 * @param [privateFile=true] {Boolean} whether the file should be stored as `private`
 * @return {Promise}
 * @since 2.0.0
 */
const uploadFile = (bucketS3, file) => {
    const fullFilename = file.localFile,
        filenameS3 = file.publicFile;
    let stream = fs.createReadStream(fullFilename);
    return new Promise((fulfill, reject) => {
        bucketS3.upload({
            Key: filenameS3,
            Body: stream,
            ACL: 'public-read',
            ContentType: mime.lookup(fullFilename)
        }, function(err, data) {
            if (err) {
                reject(err);
            }
            else {
                fulfill(data);
            }
        });
    });
};

const uploadFiles = async (cdnConfig, files) => {
    const bucketS3 = new AWS.S3({
        apiVersion: cdnConfig.apiVersion,
        accessKeyId: cdnConfig.accessKeyId,
        secretAccessKey: cdnConfig.secretAccessKey,
        params: {Bucket: cdnConfig.bucket}
    });
    return Promise.all(files.map(file => uploadFile(bucketS3, file)))
        .catch(err => console.error(err));
};

module.exports = {
    uploadFiles
};
