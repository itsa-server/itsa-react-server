/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

const Cookie = require('../cookies/cookie');

const AuthCookie = Cookie.subClass({
    isLoggedIn() {
        return this.cookieIsSet();
    }
});

module.exports = AuthCookie;
