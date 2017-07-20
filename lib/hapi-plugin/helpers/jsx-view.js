/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';
// DO NOT USE react-dom AT THIS TIME
// NEITHER react-dom nor react should be installed as a dependency:
// an error would be thrown: Warning: Document(...): React component classes must extend React.Component.

require('itsa-jsext');

const React = require('react'),
    ReactDOMServer = require('react-dom/server'),
    DEFAULTS = {
        doctype: '<!DOCTYPE html>',
        renderMethod: 'renderToStaticMarkup'
    };

let VIEW_CACHE = {};

const View = {
    compile: function(template, compileOpts) {

        const globalOptions = DEFAULTS.itsa_deepClone().itsa_merge(compileOpts, {force: true});

        return function(context, renderOpts) {
            // runtime func
            const renderOptions = globalOptions.itsa_deepClone().itsa_merge(renderOpts, {force: true});
            let output, view, method;

            output = renderOptions.doctype;
            view = renderOptions.filename;
            method = renderOptions.renderMethod;

            if (!VIEW_CACHE[view]) {
                // require(view) will invoke the code and set global.__viewComponent to the Component that the view should have specified
                require(view);
                VIEW_CACHE[view] = React.createFactory(global.__viewComponent);
            }
            output += ReactDOMServer[method](VIEW_CACHE[view](context));
            return output;
        };
    }
};

const clearCache = function() {
    VIEW_CACHE = {};
};

module.exports = {
    View: View,
    clearCache: clearCache
};
