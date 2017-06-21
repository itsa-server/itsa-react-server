const ClientCookieReadable = require('./client-cookie-readable');

const ClientPropsCookie = ClientCookieReadable.subClass(function(config) {
    this.cookieName = 'itsa-props';
    this.cookie = config.cookie; // comes from this.props.__appProps.cookie
});

module.exports = ClientPropsCookie;
