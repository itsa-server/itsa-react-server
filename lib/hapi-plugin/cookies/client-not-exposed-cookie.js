const ClientCookieBase = require('./client-cookie-base');

const ClientNotExposedCookie = ClientCookieBase.subClass(function() {
    this.cookieName = 'itsa-notexposed';
});

module.exports = ClientNotExposedCookie;
