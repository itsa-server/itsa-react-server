/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

const fetch = require('itsa-fetch'),
    controller = require('../client-controller'),
    Classes = require('itsa-classes');

const BaseClass = Classes.createClass(function() {
    const instance = this;
    instance.controller = controller;
    instance.fetch = fetch;
    instance.io = fetch.io;
},
{
    getProps: function() {
        return this.controller.getProps();
    },
    getClonedProps: function() {
        return this.controller.getClonedProps();
    },
    destroy: function() {
        this.io.abortAll();
    }
});

module.exports = BaseClass;
