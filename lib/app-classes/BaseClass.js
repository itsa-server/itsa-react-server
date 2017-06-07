'use strict';

var fetch = require('itsa-fetch'),
    controller = require('../itsa-client-controller'),
    Classes = require('itsa-classes');

var BaseClass = Classes.createClass(function() {
        this.controller = controller;
        this.fetch = fetch;
        this.io = fetch.io;
        controller.init();
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
    }
);

module.exports = BaseClass;