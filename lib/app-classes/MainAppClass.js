'use strict';

require('itsa-jsext');

var Event = require('itsa-event'),
    BaseClass = require('./BaseClass');

var MainApp = BaseClass.subClass(function() {
        var instance = this;
        instance.itsa_merge(Event.Emitter('app'));
        instance.destroy = instance.destroy.bind(instance);
        // make sure any instance._viewCompIO gets aborted:
        if (window.addEventListener) {
            window.addEventListener('unload', instance.destroy);
        }
        else {
            window.attachEvent('onunload', instance.destroy);
        }
    },
    {
        destroy: function() {
            var instance = this;
            instance.undefAllEvents();
            instance.controller.destroy();
            instance.controller.getBodyComponentInstance().componentWillUnmount();
        }
    }
);


module.exports = MainApp;