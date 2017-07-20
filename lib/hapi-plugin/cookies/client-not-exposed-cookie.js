/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

const ClientCookieBase = require('./client-cookie-base');

const ClientNotExposedCookie = ClientCookieBase.subClass(function() {
    this.cookieName = 'itsa-notexposed';
});

module.exports = ClientNotExposedCookie;
