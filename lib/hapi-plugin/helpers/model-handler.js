/* eslint no-empty: 0*/
'use strict';

require('itsa-jsext');

const cwd = process.cwd();

let GLOBAL_MODELS = {};

const merge = async (request, reply, props, modelConfig, appConfig, view) => {
    const prefix = cwd+'/src/models/',
        device = props.__appProps.device;
    let affinity = (device==='desktop') ? '' : '@'+device,
        modelFn, modelProps;

    const getModelFn = async level => {
        let affinity, modelAffinity, modelFn, promise;
        if (level===2) {
            affinity = '';
        }
        else if (level===1) {
            affinity = (device==='phone') ? '@tablet' : '';
        }
        else {
            affinity = (device==='desktop') ? '' : '@'+device;
        }
        modelAffinity = view+affinity;
        if (GLOBAL_MODELS[modelAffinity]!==undefined) {
            GLOBAL_MODELS[modelAffinity];
        }
        promise = new Promise(function(resolve) {
            try {
                modelFn = require(prefix+modelAffinity+'.js');
                resolve(modelFn);
            }
            catch (err) {
                if (err.code!=='MODULE_NOT_FOUND') {
                    console.error(err);
                }
                GLOBAL_MODELS[modelAffinity]=false;
                resolve();
            }
        });
        return await promise;
    };

    try {
        modelFn = await getModelFn(0) || await getModelFn(1) || await getModelFn(2);
    }
    catch (err) {}

    // model defined: then invoke the modelFn with the right arguments, merge the props and return
    if (modelFn) {
        GLOBAL_MODELS[view+affinity] = modelFn;
        try {
            modelProps = await modelFn(request, reply, modelConfig, props.__appProps.lang, appConfig);
            if (typeof modelProps !== 'object') {
                modelProps = {model: modelProps};
            }
            // very strange: it is like React doesn't support passing through this.props.content ??
            // we need to remove this property, ptherwise the server would crash


            if (modelProps.content) {
                console.warn('Model was created with a forbidden property "content" --> will remove the property');
                delete modelProps.content;
            }

            props.itsa_merge(modelProps);
        }
        catch (err) {
            console.error(err);
        }
    }
};

module.exports = {
    merge
};
