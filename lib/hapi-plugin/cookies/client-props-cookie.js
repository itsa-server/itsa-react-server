/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

const ClientCookieReadable = require('./client-cookie-readable');

const ClientPropsCookie = ClientCookieReadable.subClass(function(config) {
    this.cookieName = 'itsa-props';
    this.cookie = config.cookie; // comes from this.props.__appProps.cookie
});

module.exports = ClientPropsCookie;
