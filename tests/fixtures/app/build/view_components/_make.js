'use strict';

const React = require('react');

module.exports = viewName => {
    class View extends React.Component {
        render() {
            const props = this.props,
                appProps = props.__appProps,
                shown = {
                    view: viewName,
                    appView: appProps.view,
                    lang: appProps.lang,
                    langprefix: appProps.langprefix,
                    locales: appProps.locales,
                    path: appProps.path,
                    uri: appProps.uri,
                    device: appProps.device,
                    title: appProps.title,
                    loggedIn: appProps.loggedIn,
                    scope: appProps.scope,
                    cookie: appProps.cookie,
                    bodyattrcookie: appProps.bodyattrcookie,
                    initialGlobalState: appProps.initialGlobalState,
                    bodyDataAttr: props.__bodyDataAttr,
                    authentication: props.authentication,
                    authenticationMsg: props.authenticationMsg,
                    fromModel: props.fromModel,
                    modelGotToolkit: props.modelGotToolkit,
                    general: props.general,
                    generalGotToolkit: props.generalGotToolkit,
                    itsapagescript: appProps.itsapagescript,
                    itsapagelinkcss: appProps.itsapagelinkcss
                };
            return React.createElement('html', null,
                React.createElement('body', null,
                    React.createElement('h1', null, viewName),
                    React.createElement('pre', {id: 'props'}, JSON.stringify(shown))));
        }
    }
    return View;
};
