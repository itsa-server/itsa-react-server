'use strict';

let GLOBAL_VIEWS = {};
const cwd = process.cwd(),
    fs = require('fs-extra');

const generate = async (view, device) => {
    let viewname;
    const getView = async level => {
        let affinity, viewAffinity;
        if (level===2) {
            affinity = '';
        }
        else if (level===1) {
            affinity = (device==='phone') ? '@tablet' : '';
        }
        else {
            affinity = (device==='desktop') ? '' : '@'+device;
        }
        viewAffinity = view+affinity;
        if (GLOBAL_VIEWS[viewAffinity]!==undefined) {
            return GLOBAL_VIEWS[viewAffinity];
        }
        try {
            await fs.stat(cwd+'/build/view_components/'+viewAffinity+'.js');
            GLOBAL_VIEWS[viewAffinity] = viewAffinity;
        }
        catch (err) {
            GLOBAL_VIEWS[viewAffinity] = false;
        }
        return GLOBAL_VIEWS[viewAffinity];
    };
    try {
        viewname = await getView(0) || await getView(1) || await getView(2);
    }
    catch (err) {
        console.error(err);
    }
    return viewname || view;
};

module.exports = {
    generate
};
