'use strict';

require('itsa-jsext');
const fs = require('fs-extra'),
    checkFile = process.cwd()+'/src/modules-general.js';

// check if modules-general exists
// check SYNC!
let withModulesGeneral = fs.pathExistsSync(checkFile);

const toView = (pageTemplate, view, data) => {
    // invoke the view and the Component will be available by module.exports
    let prepend, append;
    prepend = 'const HtmlPage = require(\''+pageTemplate+'\');\n';
    if (withModulesGeneral) {
        prepend += 'require(\'modules-general\')\n'; // add general modules
    }

    // add a reference on the client-page which `itsa-react-server` its webapp will use to determine which view it currently is using:
    // not just define let __itsa_view__, also use it, to prevent compiler from complaining unused vars
    // also remind that uglify will transform the code, EXCEPT when it's a srting's value.
    // Therefore, we put the placeholder inside the string as well
    prepend += 'let __itsa_view__=\'__itsa_view__'+view+'\';if(__itsa_view__){__itsa_view__=null;}\n';
    // at this stage, the original `data` comes in
    // after which `append is build`
    append = '\nBody = module.exports;\n';
    append += 'class Document extends React.Component {\n';
    append += 'render() {\n';
    append += 'return (\n';
    append += '<HtmlPage {...this.props}>\n';
    append += '<Body {...this.props}/>\n';
    append += '</HtmlPage>\n';
    append += ');\n';
    append += '}\n';
    append += '}\n';
    append += 'global.__viewComponent = Document;';
    // return data;
    return Buffer.concat([new Buffer(prepend), data, new Buffer(append)]);
};

const toChunk = (pageTemplate, mainApp, view, data) => {
    let prepend, append;
    prepend = 'require(\''+pageTemplate+'\');\n'; // needed in case it has dependencies --> these need to be available in commons.js
    if (withModulesGeneral) {
        prepend += 'require(\'modules-general\')\n'; // add general modules
    }
    append = '\n';
    append += 'window.__itsa_react_server||(window.__itsa_react_server={});window.__itsa_react_server.BodyComponent=Body;\n';
    append += 'require(\''+mainApp+'\').getApp();\n'; // we need the app
    return Buffer.concat([new Buffer(prepend), data, new Buffer(append)]);
};

module.exports = {
    toChunk,
    toView
};
