/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

require('itsa-dom');
require('itsa-jsext');

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

var Controller = Classes.createClass(function() {
    var instance = this,
        initialProps = WINDOW.__itsa_react_server.props;
    instance._path = WINDOW.location.pathname;
    instance._setProps(initialProps);
    initialProps.__appProps.ga && instance._setupGA(initialProps.__appProps.ga);
    instance._initCss();
},
{
    _initBodyComponent: function() {
        var instance = this,
            BodyComponent = WINDOW.__itsa_react_server.BodyComponent;
        instance.BodyComponent = BodyComponent;
        instance._reRender();
    },

    _setupGA: function(googleAnaliticsKey) {
        var ga;
        WINDOW['GoogleAnalyticsObject'] = 'ga';
        ga = WINDOW['ga'] = WINDOW['ga'] || function() {
            (WINDOW['ga'].q = WINDOW['ga'].q || []).push(arguments);
        }, ga.l = 1 * new Date();
        ga('create', googleAnaliticsKey, 'auto');
        ga('send', 'pageview');
        io.insertScript(GOOGLE_ANALYTICS_SRC).catch(function(err) {
            delete WINDOW['GoogleAnalyticsObject'];
            delete WINDOW['ga'];
            console.warn('no google-analytics available: ', err);
        });
    },

    _setProps: function(props) {
        var instance = this,
            appProps = props.__appProps;
        instance.props = props;
        instance.view = appProps && appProps.view;
        instance.lang = appProps && appProps.lang;
        // set moduleId of the chunk
        if (appProps && appProps.routes) {
            appProps.routes.some(function(route) {
                if (route.view===instance.view) {
                    instance.componentId = route.componentId;
                    instance.routeHash = route.routeHash;
                    instance.requireId = route.requireId;
                    instance.privateView = route.privateView;
                }
                return instance.componentId;
            });
        }
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
            // add the css as an extra css
            stylenode = DOCUMENT.createElement('style');
            stylenode.setAttribute('data-src', 'inline');
            stylenode.setAttribute('type', 'text/css');
            stylenode.textContent = css;
            HEAD.appendChild(stylenode);
            instance._CssNodeOld = instance._CssNode; // will be removed after rendering the new view
            instance._CssNode = stylenode;
            if (instance.linkNode) {
                HEAD.removeChild(instance.linkNode);
                delete instance.linkNode;
            }
        }
    },

    _reRender: function() {
        var instance = this,
            props = instance.props,
            appProps = props.__appProps;
        return new Promise(function(resolve) {
            instance._markHeadAttr('data-page', instance.getView());
            instance._CssNode && instance._markHeadAttr('data-rerendercss', 'true');
            instance._renderCss();
            // now set some of the head data-attributes, which are not set by re-render the container:
            instance._markHeadAttr('data-loggedin', appProps.loggedIn);
            if (appProps.scope) {
                instance._markHeadAttr('data-scope', appProps.scope);
            }
            else {
                instance._clearHeadAttr('data-scope');
            }
            instance._markHeadAttr('lang', appProps.lang);
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
            ReactDOM.render(<BaseComponent {...props} ref={inst => instance._currentComponent=inst} />, viewContainer);
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

    isPrivateView: function() {
        return this.privateView;
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
    isOffline: function() {
        return this._offline;
    },
    setOnline: function() {
        this._offline = false;
    },
    setOffline: function() {
        this._offline = true;
    },
    setPage: function(config/* view, BodyComponent, title, props, css, componentId, requireId */) {
        var instance = this;
        DOCUMENT.title = config.title || '';
        instance.BodyComponent = config.BodyComponent;
        instance.props = config.props || {};
        // specify lang AFTER props (because of the fallback)
        instance.lang = config.lang || instance.lang || instance.props.__appProps.lang;
        instance.css = config.css || 'body{}'; // always set something, otherwise, EVEN IF EMPTY, the browser applies the previous content!
        instance.view = config.view;
        instance.componentId = config.componentId;
        instance.routeHash = config.routeHash;
        instance.requireId = config.requireId;
        instance.privateView = config.privateView;
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
