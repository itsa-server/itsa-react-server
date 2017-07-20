/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

const ClientCookieReadable = require('./client-cookie-readable');

const ClientBodyDataAttrCookie = ClientCookieReadable.subClass(function(config) {
    this.cookieName = 'itsa-bodydata';
    this.cookie = config.cookie; // comes from this.props.__appProps.bodyattrcookie
});

module.exports = ClientBodyDataAttrCookie;
