const Cookie = require('../cookies/cookie');

const AuthCookie = Cookie.subClass({
    isLoggedIn() {
        return this.cookieIsSet();
    }
});

module.exports = AuthCookie;
