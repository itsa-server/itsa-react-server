'use strict';

const prefix = process.cwd()+'/src/actions/',
    Event = require('itsa-event');

const invoke = async (action, options, request, reply, appConfig) => {
    let actionModule, clientLang, language, value;
    try {
        actionModule = require(prefix+action);
        if (typeof actionModule!=='function') {
            throw new Error('Action '+action+' should return a function');
        }
        else {
            // if request.headers['x-lang'] then the client forces the language to be re-set
            clientLang = request.headers['x-lang'];
            // check if it is a valid langage
            if (clientLang && !appConfig.languages[clientLang]) {
                clientLang = null; // undo
            }
            language = clientLang || request.language || appConfig.defaultLanguage;
            value = await actionModule(request, reply, options, language, appConfig);
            reply._replied || reply(value || {status: 'OK'});
        }
    }
    catch (err) {
        console.error(err);
        Event.emit('server:error', {message: err.message});
        reply._replied || reply(new Error('Action-file not found'));
    }
};

module.exports = {
    invoke
};
