/* eslint no-empty: 0*/

'use strict';

require('itsa-jsext');

const cwd = process.cwd(),
    Path = require('path'),
    fs = require('fs-extra'),
    hljs = require('highlight.js'),
    React = require('react'),
    ReactDOMServer = require('react-dom/server'),
    ReactDOMFactories = require('react-dom-factories'),
    Remarkable = require('remarkable');

const md = new Remarkable({
    html: true,
    xhtmlOut: true,
    breaks: true,
    typographer: true,
    quotes: '“”‘’',
    linkify: true,
    langPrefix:   'hljs language-',
    highlight: function(str, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(lang, str).value;
            }
            catch (__) {}
        }
        try {
            return hljs.highlightAuto(str).value;
        }
        catch (__) {}
        return ''; // use external default escaping
    }
});

class ReactMarkdown extends React.Component {
    render() {
        const props = this.props,
            innerHtml = md.render(props.source || '');
        return ReactDOMFactories.div({dangerouslySetInnerHTML: {__html: innerHtml}});
    }
}

const FsMarkdown = {
    async readFile(filename, returnPlainText) {
        let returnObject, Component, staticMarkup, filecontent;
        if (filename.itsa_endsWith('.md', true)) {
            try {
                filecontent = await fs.readFile(Path.resolve(cwd, 'src/models', filename), 'utf8');
                Component = React.createElement(ReactMarkdown, {source: filecontent});
                staticMarkup = ReactDOMServer.renderToStaticMarkup(Component);
                returnObject = returnPlainText ? staticMarkup : {__html: staticMarkup};
            }
            catch (err) {
                console.warn(err);
            }
        }
        if (!returnObject) {
            returnObject = returnPlainText ? '' : {__html: ''};
        }
        return returnObject;
    }
};

module.exports = FsMarkdown;
