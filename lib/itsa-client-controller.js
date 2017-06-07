'use strict';

require('itsa-dom/lib/polyfill');
require('itsa-jsext/lib/object');

var utils = require('itsa-utils'),
    isNode = utils.isNode,
    NOOP = function() {},
    WINDOW = isNode ? {
     document: {
         head: {
             appendChild: NOOP
         },
         createElement: NOOP
     },
     location: {}
    } : window,
    React = require('react'), // DO NOT REMOVE! (even if unused)
    ReactDOM = require('react-dom'),
    DOCUMENT = WINDOW.document,
    HEAD = DOCUMENT.head,
    async = utils.async,
    io = require('itsa-fetch').io,
    Classes = require('itsa-classes'),
    GOOGLE_ANALYTICS_SRC = '//www.google-analytics.com/analytics.js';


var Controller = Classes.createClass({
        init: function() {
            var instance = this,
                exports = WINDOW.__itsa_react_server;
            instance._path = WINDOW.location.pathname;
            if (exports && exports.props) {
                instance._initProps();
            }
            if (exports && exports.BodyComponent) {
                instance._init();
            }
        },

        _initProps: function() {
            var instance = this,
                exports = WINDOW.__itsa_react_server;
            if (instance._propsInitiated) {
                return;
            }
            instance._propsInitiated = true;
            instance._setProps(exports.props);
            instance.props.__ga && instance._setupGA(instance.props.__ga);
        },

        _init: function() {
            var instance = this,
                exports = WINDOW.__itsa_react_server;
            if (instance._isInitiated) {
                return;
            }
            instance._isInitiated = true;
            instance.BodyComponent = exports.BodyComponent;
            delete WINDOW.__itsa_react_server;
            instance._initCss();
            instance._reRender();
        },

        _setupGA: function(googleAnaliticsKey) {
            var ga;
            WINDOW['GoogleAnalyticsObject'] = 'ga';
            ga = WINDOW['ga'] = WINDOW['ga'] || function() {
                (WINDOW['ga'].q = WINDOW['ga'].q || []).push(arguments);
            },ga.l = 1 * new Date();
            ga('create', googleAnaliticsKey, 'auto');
            ga('send', 'pageview');
            io.insertScript(GOOGLE_ANALYTICS_SRC).catch(function(err) {
                delete WINDOW['GoogleAnalyticsObject'];
                delete WINDOW['ga'];
                console.warn('no google-analytics available: ', err);
            });
        },

        _setProps: function(props) {
            var instance = this;
            instance.props = props;
            instance.view = props.__view;
            instance.lang = props.__lang;

            // set moduleId of the chunk
            props.__routes && props.__routes.some(function(route) {
                if (route.view===instance.view) {
                    instance.componentId = route.componentId;
                    instance.routeHash = route.routeHash;
                    instance.requireId = route.requireId;
                }
                return instance.componentId;
            });

            instance.staticView = props.__staticView;
        },

        _initCss: function() {
            var stylenode;
            // If the css was set through a `link`-element, we transfer it into a `style` element.
            // this way, we can manage its content
            var instance = this;
            instance.linkNode = DOCUMENT.querySelector('link[data-src="inline"]');
            if (!instance.linkNode) {
                stylenode = DOCUMENT.querySelector('style[data-src="inline"]');
            }
            if (instance.linkNode || !stylenode) {
                stylenode = DOCUMENT.createElement('style');
                stylenode.setAttribute('data-src', 'inline');
                stylenode.setAttribute('type', 'text/css');
                HEAD.appendChild(stylenode);
                instance._CssNode = stylenode;
                // cannot set instance.css --> will need to be loaded and set with next `setPage`
            }
            else {
                instance.css = stylenode.textContent;
            }
            instance._CssNode = stylenode;
        },

        _renderCss: function() {
            var instance = this,
                css = instance.css,
                stylenode;
            if (css) {
                if (instance.linkNode) {
                    HEAD.removeChild(instance.linkNode);
                    delete instance.linkNode;
                }
                // add the css as an extra css
                stylenode = DOCUMENT.createElement('style');
                stylenode.setAttribute('data-src', 'inline');
                stylenode.setAttribute('type', 'text/css');
                stylenode.textContent = css;
                HEAD.appendChild(stylenode);
                instance._CssNodeOld = instance._CssNode; // will be removed after rendering the new view
                instance._CssNode = stylenode;
            }
        },

        _reRender: function() {
            var instance = this;
            return new Promise(function(resolve) {
                instance._markHeadAttr('data-page', instance.getView());
                instance._CssNode && instance._markHeadAttr('data-rerendercss', 'true');
                instance._renderCss();
                // ff has issues when rendering comes immediate after setting new css.
                // therefore we go async:
                async(function() {
                    instance._createBodyElement(instance.props);
                    // now remove the old css of the previous view
                    if (instance._CssNodeOld) {
                        async(function() {
                            HEAD.removeChild(instance._CssNodeOld);
                            delete instance._CssNodeOld;
                            async(function() {
                                instance._clearHeadAttr('data-rerendercss');
                                resolve();
                            });
                        });
                    }
                    else {
                        instance._clearHeadAttr('data-rerendercss');
                        resolve();
                    }
                });
            });
        },

        _createBodyElement: function(props) {
            var instance = this,
                BaseComponent = instance.getBodyComponent(),
                viewContainer = DOCUMENT.getElementById('view-container');
            if (viewContainer) {
                instance._currentComponent = ReactDOM.render(<BaseComponent {...props} />, viewContainer);
            }
            else {
                console.error('The view-container seems to be removed from the DOM, cannot render the page');
            }
        },

        _clearHeadAttr: function(attr) {
            DOCUMENT.documentElement.removeAttribute(attr);
        },

        _markHeadAttr: function(attr, value) {
            DOCUMENT.documentElement.setAttribute(attr, value);
        },

        getComponentId: function() {
            return this.componentId;
        },

        getRequireId: function() {
            return this.requireId;
        },

        getRouteHash: function() {
            return this.routeHash;
        },

        getClonedProps: function() {
            return (this.props || {}).itsa_deepClone();
        },

        getProps: function() {
            return this.props;
        },

        getView: function() {
            return this.view;
        },

        getLang: function() {
            return this.lang;
        },

        isStaticView: function() {
            return this.staticView;
        },

        getTitle: function() {
            return DOCUMENT.title;
        },

        getBodyComponent: function() {
            return this.BodyComponent;
        },

        getCss: function() {
            return this._CssNode.textContent;
        },

        getPath: function() {
            return this._path;
        },

        getBodyComponentInstance: function() {
            return this._currentComponent;
        },

        forceUpdate: function(newProps) {
            var instance = this;
            newProps && instance._setProps(newProps);
            if (instance._currentComponent) {
                if (newProps) {
                    instance._createBodyElement(newProps);
                }
                else {
                    instance._currentComponent.forceUpdate();
                }
            }
        },

        setPage: function(config/* view, BodyComponent, title, props, css, staticView, componentId, requireId */) {
            var instance = this;
            DOCUMENT.title = config.title || '';
            instance.BodyComponent = config.BodyComponent;
            instance.props = config.props || {};
            // specify lang AFTER props (because of the fallback)
            instance.lang = config.lang || instance.lang || instance.props.__lang;
            instance.css = config.css || '';
            instance.view = config.view;
            instance.componentId = config.componentId;
            instance.routeHash = config.routeHash;
            instance.requireId = config.requireId;
            instance.staticView = (typeof config.staticView==='boolean') ? config.staticView : false;
            instance._path = WINDOW.location.pathname;
            return instance._reRender();
        }

    });

if (!WINDOW.__ITSA_CLIENT_CONTROLLER) {
    WINDOW.__ITSA_CLIENT_CONTROLLER = isNode ?
        {
            getProps: NOOP
        } :
        new Controller();
}

module.exports = WINDOW.__ITSA_CLIENT_CONTROLLER;