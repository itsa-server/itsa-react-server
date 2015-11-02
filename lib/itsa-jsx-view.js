'use strict';

let VIEW_CACHE = {};

const React = require('react');

const DEFAULTS = {
    doctype: '<!DOCTYPE html>',
    renderMethod: 'renderToStaticMarkup'
};

const View = {
    compile(template, compileOpts) {

        let globalOptions = {};
        Object.assign(globalOptions, DEFAULTS, compileOpts);

        return (context, renderOpts) => {
            // runtime func
            let renderOptions = {},
                output, view, method;

            Object.assign(renderOptions, globalOptions, renderOpts);
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

const clearCache = () => {
    VIEW_CACHE = {};
};

module.exports = {
    View,
    clearCache
};
