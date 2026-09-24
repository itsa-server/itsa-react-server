/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

/* eslint no-empty: 0*/
'use strict';

require('itsa-jsext');

const cwd = process.cwd(),
    path = require('path');

let GLOBAL_MODELS = {};

const notFoundModuleNotEqualsModel = (err, fullModuleFileName) => {
    const errMsg = err.message,
        notFoundFile = errMsg.substring(20, errMsg.length-1);
    return (path.resolve(cwd, notFoundFile)!==fullModuleFileName);
};

const merge = async (request, reply, props, routeOptions, appConfig, view) => {
    const prefix = cwd+'/src/models/',
        device = props.__appProps.device;
    let affinity = (device==='desktop') ? '' : '@'+device,
        modelFn, modelProps, internalError;

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
                if ((err.code!=='MODULE_NOT_FOUND') || (internalError=notFoundModuleNotEqualsModel(err, prefix+modelAffinity+'.js'))) {
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
            console.debug(request, 'invoke model', '"'+view+affinity+'"', 'query:', request.query, 'params:', request.params, 'payload:', request.payload);
            modelProps = await modelFn(request, reply, routeOptions || {}, props.__appProps.lang, appConfig);
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
    else if (appConfig.debug) {
        if (internalError) {
            console.debug(request, 'model ', '"'+view+affinity+'"', ' has an internal error (see above)');
        }
        else {
            console.debug(request, 'no model found for ', '"'+view+affinity+'"');
        }
    }
};

module.exports = {
    merge
};
