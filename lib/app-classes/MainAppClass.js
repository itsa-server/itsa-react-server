'use strict';

require('itsa-jsext');

const Event = require('itsa-event'),
    BaseClass = require('./BaseClass');

const MainApp = BaseClass.subClass(function() {
    const instance = this;
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
});

module.exports = MainApp;
