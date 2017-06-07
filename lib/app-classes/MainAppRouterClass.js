'use strict';

var ItsaRouterClass = require('../itsa-react-router'),
    MainAppClass = require('./MainAppClass');

var MainAppRouter = MainAppClass.subClass(function() {
        this.router = new ItsaRouterClass();
    },
    {
        destroy: function() {
            this.router.destroy();
        }
    }
);


module.exports = MainAppRouter;