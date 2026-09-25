/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

const refresh = (request, h, appConfig) => {
    // refresh the ttl of the cookies
    if (appConfig['app-authentication'] && appConfig['app-authentication'].enabled) {
        request.getAuthCookie().refreshTtl(h);
    }
    if (appConfig.cookies) {
        if (appConfig.cookies['body-data-attr'] && appConfig.cookies['body-data-attr'].enabled) {
            request.getBodyDataAttrCookie().refreshTtl(h);
        }
        if (appConfig.cookies['not-exposed'] && appConfig.cookies['not-exposed'].enabled) {
            request.getNotExposedCookie().refreshTtl(h);
        }
        if (appConfig.cookies.props && appConfig.cookies.props.enabled) {
            request.getPropsCookie().refreshTtl(h);
        }
    }
};

module.exports = {
    refresh
};
