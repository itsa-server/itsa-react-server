'use strict';
// DO NOT USE react-dom AT THIS TIME
// NEITHER react-dom nor react should be installed as a dependency:
// an error would be thrown: Warning: Document(...): React component classes must extend React.Component.

require('itsa-jsext/lib/object');

var VIEW_CACHE = {},
    React = require('react'),
    ReactDOM = require('react-dom/server'),
    DEFAULTS = {
        doctype: '<!DOCTYPE html>',
        renderMethod: 'renderToStaticMarkup'
    };

var View = {
    compile: function(template, compileOpts) {

        var globalOptions = DEFAULTS.itsa_deepClone().itsa_merge(compileOpts, {force: true});

        return function(context, renderOpts) {
            // runtime func
            var renderOptions = globalOptions.itsa_deepClone().itsa_merge(renderOpts, {force: true}),
                output, view, method;

            output = renderOptions.doctype;
            view = renderOptions.filename;
            method = renderOptions.renderMethod;

            if (!VIEW_CACHE[view]) {
                // require(view) will invoke the code and set module.exports to the Component that the view should have specified
                require(view);
                VIEW_CACHE[view] = React.createFactory(global.__viewComponent);
            }
            output += ReactDOM[method](VIEW_CACHE[view](context));

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
