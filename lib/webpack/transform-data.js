/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

require('itsa-jsext');
const fs = require('fs-extra'),
    cwd = process.cwd(),
    checkFile = cwd+'/src/modules-general.js',
    regexpRequireJS = /module.exports(?: )+=(?: )+(\w+)/,
    regexpES6 = /export(?: )+default(?: )+(\w+)/;

// check if modules-general exists
// check SYNC!
let withModulesGeneral = fs.pathExistsSync(checkFile);

const extractComponentFromFilename = async (filename, upcase) => {
    let extraAppend = '',
        fileContent, bodyComponent, match;
    try {
        fileContent = await fs.readFile(filename, 'utf8');
        // extract the BodyComponent, either by looking for `module.exports = {Component}` or by `export default {Component}`
        match = fileContent.match(regexpES6);
        bodyComponent = match && match[1];
        if (!bodyComponent) {
            // try commonJS
            match = fileContent.match(regexpRequireJS);
            bodyComponent = match && match[1];
            // in case
        }
        if (!bodyComponent) {
            console.warn('No valid Component exported for file', filename);
            console.warn('Assume the name to equal `Body`');
            extraAppend += '\n// no valid Component exported\n';
            extraAppend += '// ERROR: cannot read export Component from '+filename+' --> assume the name to equal `Body`;\n';
            bodyComponent = 'Body'; // <-- at least we have something, but will likely break
        }
        else if (upcase && (bodyComponent[0].toUpperCase()!==bodyComponent[0])) {
            // When serverside rendering, we might face the next issue:
            // if bodyComponent starts with a lowercase, then we need to transform it into UpperCase, in order to render well:
            extraAppend += 'const ITSA_Transformed_Component = '+bodyComponent+'\n';
            bodyComponent = 'ITSA_Transformed_Component';
        }
    }
    catch (err) {
        console.error(err);
        extraAppend += '\n// ERROR: cannot read export Component from '+filename+' --> assume the name to equal `Body`;\n';
        bodyComponent = 'Body'; // <-- at least we have something, but will likely break
    }
    return {
        bodyComponent,
        extraAppend
    };
};

const toStaticComponent = async (filename, data) => {
    const extractComponent = await extractComponentFromFilename(filename, true),
        append = '\nglobal.__viewComponent = '+extractComponent.bodyComponent+';';
    // return data;
    return Buffer.concat([data, new Buffer(append)]);
};

const toView = async (pageTemplate, filename, view, data) => {
    // invoke the view and the Component will be available by module.exports
    let prepend, append, extractComponent;
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
    // first, we need to figure out what `name` the exported Component has got:
    append = '';
    extractComponent = await extractComponentFromFilename(filename, true);
    append += extractComponent.extraAppend;
    append += 'class Document extends React.Component {\n';
    append += 'render() {\n';
    append += 'return (\n';
    append += '<HtmlPage {...this.props}>\n';
    append += '<'+extractComponent.bodyComponent+' {...this.props}/>\n';
    append += '</HtmlPage>\n';
    append += ');\n';
    append += '}\n';
    append += '}\n';
    append += 'global.__viewComponent = Document;';
    // return data;
    return Buffer.concat([new Buffer(prepend), data, new Buffer(append)]);
};

const toChunk = async (pageTemplate, filename, mainApp, view, data) => {
    let prepend, append, extractComponent;
    prepend = 'require(\''+pageTemplate+'\');\n'; // needed in case it has dependencies --> these need to be available in commons.js
    if (withModulesGeneral) {
        prepend += 'require(\'modules-general\')\n'; // add general modules
    }
    append = '\n';
    extractComponent = await extractComponentFromFilename(filename);
    append += extractComponent.extraAppend;
    append += 'window.__itsa_react_server||(window.__itsa_react_server={});window.__itsa_react_server.BodyComponent='+extractComponent.bodyComponent+';\n';
    append += 'require(\''+mainApp+'\').getApp();\n'; // we need the app
    return Buffer.concat([new Buffer(prepend), data, new Buffer(append)]);
};

module.exports = {
    toChunk,
    toView,
    toStaticComponent
};
