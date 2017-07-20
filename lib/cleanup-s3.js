/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

require('itsa-jsext');

const AWS = require('aws-sdk');

/**
 * Removes a file from AWS-S3
 *
 * @method removeFile
 * @param filenameS3 {String} the full S3-filename to be reomved
 * @return {Promise}
 * @since 2.0.0
 */
const removeFile = (bucketS3, filenameS3) => {
    return new Promise((fulfill, reject) => {
        bucketS3.deleteObject({
            Key: filenameS3
        }, function(err) {
            if (err) {
                reject(err);
            }
            else {
                fulfill();
            }
        });
    });
};

/**
 * Lists all objects from a S3-folder, with a max of 1000 elements.
 *
 * @method _listObjects
 * @return {Promise} resolves with an array of object that have the type: {Key: String}
 * @private
 * @since 2.0.0
 */
const listObjectsS3 = (bucketS3, nextMarker) => {
    return new Promise((fulfill, reject) => {
        bucketS3.listObjects({
            Delimiter: ';',
            EncodingType: 'url',
            Marker: nextMarker || '#',
            MaxKeys: 1000
        }, function(err, data) {
            if (err) {
                reject(err);
            }
            else {
                fulfill(data);
            }
        });
    }).then(data => {
        let items = data.Contents;
        if (!data.IsTruncated) {
            return items;
        }
        return listObjectsS3(bucketS3, data.NextMarker)
            .then(nestedItems => {
                Array.prototype.push.apply(items, nestedItems);
                return items;
            });
    });
};

const getFileListS3 = bucketS3 => {
    return listObjectsS3(bucketS3)
        .then(items => items.map(item => item.Key));
};

const cleanupFiles = async (cdnConfig, keepCdnFiles) => {
    let list = [],
        awsFiles;
    const bucketS3 = new AWS.S3({
        apiVersion: cdnConfig.apiVersion,
        accessKeyId: cdnConfig.accessKeyId,
        secretAccessKey: cdnConfig.secretAccessKey,
        params: {Bucket: cdnConfig.bucket}
    });
    awsFiles = await getFileListS3(bucketS3);
    awsFiles.forEach(file => {
        if (!keepCdnFiles.itsa_contains(file)) {
            list.push(removeFile(bucketS3, file));
        }
    });
    return Promise.all(list);
};

module.exports = {
    cleanupFiles
};
