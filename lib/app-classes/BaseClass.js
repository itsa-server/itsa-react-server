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
