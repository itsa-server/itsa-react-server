/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

const cwd = process.cwd(),
    reload = require('require-reload')(require), // see https://github.com/fastest963/require-reload
    cdnDeployProject = require(cwd+'/cdn-deploy'),
    environment = process.argv[2] || process.env.NODE_ENV || 'local',
    getManifest = require('./hapi-plugin/helpers/get-manifest');

const deploy = () => {
    const fullManifest = reload('./load-manifest'),
        environmentManifest = getManifest.generate(environment, fullManifest);

    if (environmentManifest.cdn && environmentManifest.cdn.enabled) {
        console.log('Starting cdn deploy to', environmentManifest.cdn.url);
        return cdnDeployProject.deploy(environmentManifest.cdn, environmentManifest)
            .then(() => {
                console.log('Deploy to cdn ready');
            })
            .catch(err => {
                console.log('Deploy to cdn errored:', err);
            });
    }
};

module.exports = {
    deploy
};
