'use strict';

module.exports = {
    maxItemsOnPage: 15,
//    limit: maxItemsOnPage * 4, ,-- not set here: when no value, it will be calculated by ddos-prevention
    maxexpiry: 120,
    checkinterval: 1,
    trustProxy: true,
    includeUserAgent: true,
    whitelist: [],
    errormessage: 'Error',
    testmode: false,
    silent: true,
    silentStart: true,
    logBlocked: true,
    responseStatus: 429
};
