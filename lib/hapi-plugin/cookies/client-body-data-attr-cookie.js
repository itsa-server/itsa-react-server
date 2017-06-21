const ClientCookieReadable = require('./client-cookie-readable');

const ClientBodyDataAttrCookie = ClientCookieReadable.subClass(function(config) {
    this.cookieName = 'itsa-bodydata';
    this.cookie = config.cookie; // comes from this.props.__appProps.bodyattrcookie
});

module.exports = ClientBodyDataAttrCookie;
