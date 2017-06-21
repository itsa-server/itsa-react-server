const refresh = (request, reply, appConfig) => {
    // refresh the ttl of the cookies
    if (appConfig['app-authentication'] && appConfig['app-authentication'].enabled) {
        request.getLoginCookie().refreshTtl(reply);
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
