/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

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
