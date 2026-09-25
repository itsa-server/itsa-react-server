/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

const prefix = process.cwd()+'/src/actions/',
    Boom = require('@hapi/boom'),
    Event = require('itsa-event'),
    LEGACY_REPLY_HINT = 'actions must return a value or h.response(...)',
    LEGACY_REPLY_ERROR = /^(h|reply) is not a function$/;

// Runs src/actions/<action>.js and returns what hapi should send (spec §6.2):
// the action's value (or {status: 'OK'}), a Boom error with its own status, or a 500.
const invoke = async (action, options, request, h, appConfig) => {
    let actionModule, clientLang, language, value;
    try {
        actionModule = require(prefix+action);
        if (typeof actionModule!=='function') {
            throw new Error('Action '+action+' should return a function');
        }
    }
    catch (err) {
        console.error(err);
        Event.emit('server:error', {message: err.message});
        return Boom.badImplementation('Action-file not found');
    }
    try {
        // if request.headers['x-lang'] then the client forces the language to be re-set
        clientLang = request.headers['x-lang'];
        // check if it is a valid langage
        if (clientLang && !appConfig.languages[clientLang]) {
            clientLang = null; // undo
        }
        language = clientLang || request.language || appConfig.defaultLanguage;
        console.debug(request, 'invoke action', '"'+action+'"', 'query:', request.query, 'params:', request.params, 'payload:', request.payload);
        value = await actionModule(request, h, options, language, appConfig);
        return value || {status: 'OK'};
    }
    catch (err) {
        if ((err instanceof TypeError) && LEGACY_REPLY_ERROR.test(err.message)) {
            console.error(err, '-->', LEGACY_REPLY_HINT);
        }
        else {
            console.error(err);
        }
        Event.emit('server:error', {message: err.message});
        return Boom.isBoom(err) ? err : Boom.badImplementation();
    }
};

module.exports = {
    invoke
};
