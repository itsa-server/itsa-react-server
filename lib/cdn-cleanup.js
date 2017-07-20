/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

const cwd = process.cwd(),
    cdnCleanupProject = require(cwd+'/cdn-cleanup'),
    fullManifest = require('./load-manifest'),
    environment = process.env.NODE_ENV || 'local',
    getManifest = require('./hapi-plugin/helpers/get-manifest'),
    environmentManifest = getManifest.generate(environment, fullManifest);

const cleanup = () => {
    if (environmentManifest.cdn && environmentManifest.cdn.cleanupPrevious && (fullManifest.cdn.url!==environmentManifest.cdn.url)) {
        environmentManifest.cdn.enabled && console.log('Cleaning up unused files from cdn', environmentManifest.cdn.url);
        cdnCleanupProject.cleanup(environmentManifest.cdn, environmentManifest)
            .then(() => {
                environmentManifest.cdn.enabled && console.log('Cleaning up cdn ready');
            })
            .catch(err => {
                console.log('Cleaning up cdn errored:', err);
            });
    }
};

module.exports = {
    cleanup
};
