'use strict';

var VIEW_CACHE = {},
    React = require('react'),
    DEFAULTS = {
        doctype: '<!DOCTYPE html>',
        renderMethod: 'renderToStaticMarkup'
    },
    objectAssign = require('object-assign');

var View = {
    compile: function(template, compileOpts) {

        var globalOptions = {};
        objectAssign(globalOptions, DEFAULTS, compileOpts);

        return function(context, renderOpts) {
            // runtime func
            var renderOptions = {},
                output, view, method;

            objectAssign(renderOptions, globalOptions, renderOpts);
            output = renderOptions.doctype;
            view = renderOptions.filename;
            method = renderOptions.renderMethod;

            if (!VIEW_CACHE[view]) {
                // require(view) will invoke the code and set module.exports to the Component that the view should have specified
                require(view);
                VIEW_CACHE[view] = React.createFactory(global.__viewComponent);
            }

            output += React[method](VIEW_CACHE[view](context));

            return output;
        };
    }
};

var clearCache = function() {
    VIEW_CACHE = {};
};

module.exports = {
    View: View,
    clearCache: clearCache
};
