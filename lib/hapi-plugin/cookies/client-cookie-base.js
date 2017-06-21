'use strict';

require('itsa-jsext');

const fetch = require('itsa-fetch'),
    Classes = require('itsa-classes');

const BaseClass = Classes.createClass(function(config) {
    const instance = this;
    instance.cookieName = config.cookieName;
    instance.router = config.router;
    instance.io = fetch.io;
},
{
    defineProps(props) {
        const instance = this;
        if (typeof props==='object') {
            return instance.router.reloadView(false, {
                'x-cookie': instance.cookieName,
                'x-cookieprops': JSON.stringify(props),
                'x-action': 'define'
            }).then(() => {
                if (instance.cookieName==='itsa-bodydata') {
                    instance.defineBodyAttrs(props);
                }
            });
        }
    },
    setProps(props) {
        const instance = this;
        if (typeof props==='object') {
            return instance.router.reloadView(false, {
                'x-cookie': instance.cookieName,
                'x-cookieprops': JSON.stringify(props),
                'x-action': 'set'
            }).then(() => {
                if (instance.cookieName==='itsa-bodydata') {
                    instance.addBodyAttrs(props);
                }
            });
        }
    },
    deleteProp(key) {
        const instance = this;
        if ((typeof key==='string') && (key!=='')) {
            return instance.router.reloadView(false, {
                'x-cookie': instance.cookieName,
                'x-key': key,
                'x-action': 'delete'
            }).then(() => {
                if (instance.cookieName==='itsa-bodydata') {
                    instance.removeBodyAttrs(key);
                }
            });
        }
    },
    removeCookie() {
        const instance = this;
        return instance.router.reloadView(false, {
            'x-cookie': instance.cookieName,
            'x-action': 'remove'
        }).then(() => {
            if (instance.cookieName==='itsa-bodydata') {
                instance.clearBodyAttrs();
            }
        });
    },
    changeTtl(ms) {
        const instance = this;
        return instance.router.reloadView(false, {
            'x-cookie': instance.cookieName,
            'x-ms': ms,
            'x-action': 'ttl'
        });
    },
    _getAttributeList() {
        let list = {};
        Array.prototype.forEach.call(document.body.attributes, item => {
            if (item.name.itsa_startsWith('data-', true)) {
                list[item.name] = item.value;
            }
        });
        return list;
    },
    defineBodyAttrs(props) {
        // make a list of all current attributes and store them in a temp list:
        let currentProps = this._getAttributeList();
        // add all the attributes that are required
        props.itsa_each((value, key) => {
            // check is attribute is already defined (and the same). Only take action is there is a difference
            if (currentProps['data-'+key]!==value) {
                document.body.setAttribute('data-'+key, value);
                // remove from the tempPros-list, because whatever this list remains should eventually be removed
                delete currentProps['data-'+key];
            }
        });
        // remove whatever is remained inside tempPros-list:
        currentProps.itsa_each((value, key) => {
            this.removeBodyAttrs(key);
        });
    },
    addBodyAttrs(props) {
        let currentProps = this._getAttributeList();
        // add all the attributes that are required
        props.itsa_each((value, key) => {
            // check is attribute is already defined (and the same). Only take action is there is a difference
            if (currentProps['data-'+key]!==value) {
                document.body.setAttribute('data-'+key, value);
            }
        });
    },
    removeBodyAttrs(key) {
        document.body.removeAttribute('data-'+key);
    },
    clearBodyAttrs() {
        let currentProps = this._getAttributeList();
        currentProps.itsa_each((value, key) => {
            this.removeBodyAttrs(key);
        });
    },
    destroy() {
        this.io.abortAll();
    }
});

module.exports = BaseClass;
