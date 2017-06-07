'use strict';

const cwd = process.cwd(),
    jsStringEscape = require('js-string-escape'),
    fs = require('fs-extra'),
    path = require('path'),
    MODULE_REG_EXP = /([a-zA-Z]+)\.exports ?=/;

const build = chunkMap => {
    chunkMap.forEach(chunk => {
        let view = chunk.name,
            componentId = chunk.componentId,
            requireId = chunk.requireId,
            inlineScript, newData, fileContent;

        srcFile = dir+'js/app.js',
        srcData = fs.readFileSync(srcFile, 'utf8');
        // remove the `require.ensure` references before we merge the app into the common app:
        fileContent = fs.readFileSync(path.resolve(cwd, 'build/js/components/'+componentId+'.js'), 'utf8');
        inlineScript = jsStringEscape(fileContent);
        // find variablename module:
        match = srcData.match(MODULE_REG_EXP);
        variableNameModule = match && match[1];
        // NOTE: eval must start with 0?0: for IE9 compatibility --> see http://stackoverflow.com/questions/6807649/problems-with-ie9-javascript-eval
        newData = srcData.substr(0, startmarkerPos) +
                  'try{eval(\'0?0:'+inlineScript+'\');}catch(e){console.warn(\'eval-error:\',e);}window.__itsa_react_server||(window.__itsa_react_server={});window.__itsa_react_server.BodyComponent=arguments[2]('+requireId+');' +
                  srcData.substring(endmarkerPos+1, startmarkerPos2)+
                  '\nnew '+variableNameModule+'.exports();'+
                  srcData.substr(endmarkerPos2+1);
        destFile = path.resolve(cwd, 'pageapps/'+view.itsa_replaceAll('_', '/')+'.js');
        fs.outputFileSync(destFile, newData);
    });
};

module.exports = {
  build
};
