/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

const refresh = (request, reply, appConfig) => {
    // refresh the ttl of the cookies
    if (appConfig['app-authentication'] && appConfig['app-authentication'].enabled) {
        request.getAuthCookie().refreshTtl(reply);
    }
    if (appConfig.cookies) {
        if (appConfig.cookies['body-data-attr'] && appConfig.cookies['body-data-attr'].enabled) {
            request.getBodyDataAttrCookie().refreshTtl(reply);
        }
        if (appConfig.cookies['not-exposed'] && appConfig.cookies['not-exposed'].enabled) {
            request.getNotExposedCookie().refreshTtl(reply);
        }
        if (appConfig.cookies.props && appConfig.cookies.props.enabled) {
            request.getPropsCookie().refreshTtl(reply);
        }
    }
};

module.exports = {
    refresh
};
