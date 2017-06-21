require('itsa-jsext');

const ClientCookieBase = require('./client-cookie-base');

const ClientBodyDataAttrCookie = ClientCookieBase.subClass({
    getProps() {
        return this.cookie || {};
    },
    defineProps(props) {
        this.cookie = props;
        // now access `defineProps` from ClientCookieBase:
        this.$superProp('defineProps', props);
    },
    setProps(props) {
        this.cookie || (this.cookie={});
        this.cookie.itsa_merge(props, {force: true});
        // now access `setProps` from ClientCookieBase:
        this.$superProp('setProps', props);
    }
});

module.exports = ClientBodyDataAttrCookie;
