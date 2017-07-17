/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

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
        const instance = this;
        instance.undefAllEvents();
        instance.controller.destroy();
        instance.controller.getBodyComponentInstance().componentWillUnmount();
    }
});

module.exports = MainApp;
