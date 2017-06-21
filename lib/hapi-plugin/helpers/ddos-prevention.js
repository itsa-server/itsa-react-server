/* eslint no-console: 0*/

require('itsa-jsext');

const Classes = require('itsa-classes'),
    later = require('itsa-utils').later,
    defaultParams = require('./ddos-default-params'),
    LIMIT_MULTIPLIER = 4,
    DEF_SERVICEWORKER_ITEM_COUNT = 250,
    SERVICE_WORKER_EXPIRE_MS = 60000; // 1 minute

var Ddos = Classes.createClass(function(config) {
    // maxexpiry, checkinterval is in seconds
    // limit is the maximum count
    const instance = this;
    let params;
    instance.params = params = config.itsa_deepClone();
    instance.params.serviceWorkerItemCount || (instance.params.serviceWorkerItemCount || DEF_SERVICEWORKER_ITEM_COUNT);
    instance.table = {};
    instance.tableSW = {};

    params.itsa_merge(defaultParams); // will not overwrite
    if (!instance.params.limit) {
        instance.params.limit = LIMIT_MULTIPLIER * instance.params.maxItemsOnPage;
    }
    if (!params.silentStart || !params.silent) {
        console.log('ddos prevention starts with params:', params);
    }
    instance.startTimers();
},
{
    startTimers() {
        const instance = this;
        instance._timer = later(instance.update.bind(instance), instance.params.checkinterval*1000, true);
        instance._timerSW = later(instance.cleanupSW.bind(instance), SERVICE_WORKER_EXPIRE_MS, true);
    },
    update() {
        const instance = this;
        let table = instance.table;
        if (!instance.params.silent) {
            console.log('refresh ddos prevention update', table);
        }
        table.itsa_each((item, key) => {
            item.expiry -= instance.params.checkinterval;
            if (item.expiry<=0) {
                if (!instance.params.silent) {
                    console.log('removing address from table:', key);
                }
                delete table[key];
            }
        });
    },
    cleanupSW() {
        const instance = this,
            cleanupTime = Date.now() - SERVICE_WORKER_EXPIRE_MS;
        let tableSW = instance.tableSW;
        if (!instance.params.silent) {
            console.log('cleanup ddos serviceworker prevention update', tableSW);
        }
        tableSW.itsa_each((item, key) => {
            if (item.lastUpdate<=cleanupTime) {
                if (!instance.params.silent) {
                    console.log('removing address from serviceworker table:', key);
                }
                delete tableSW[key];
            }
        });
    },
    allowedServiceworkerRequest(address) {
        const instance = this,
            params = instance.params,
            tableSW = instance.tableSW;
        if (!tableSW[address]) {
            tableSW[address] = {count: 1, lastUpdate: Date.now()};
        }
        else {
            tableSW[address].count++;
            tableSW[address].lastUpdate = Date.now();
        }
        return (tableSW[address].count<=params.serviceWorkerItemCount);
    },
    handle(request) {
        const instance = this,
            params = instance.params,
            table = instance.table;
        var address, returnObject;

        if (!params.silent) {
            console.log('ddos-prevention handle according to table', table);
        }
        address = params.trustProxy ? (request.headers['x-forwarded-for'] || request.info.remoteAddress) : request.info.remoteAddress;
        if (!params.silent) {
            console.log('Address:', address);
        }
        if (params.whitelist.itsa_contains(address)) {
            if (!params.silent) {
                console.log(address, 'whitelisted: ', address);
            }
            return {ok: true};
        }
        if (params.isDevelopment) {
            // ignore requests to .js.map and .css.map files: they won't be there in production
            if (request.path.itsa_endsWith('.js.map') || request.path.itsa_endsWith('.css.map')) {
                if (!params.silent) {
                    console.log('ddos prevention: mapfile allways allowed in development:', request.path);
                }
                return {ok: true};
            }
        }
        if (params.includeUserAgent) {
            address += '#'+request.headers['user-agent'];
        }
        // if from serviceworker INIT, then our serviceworker has set a request-header: x-itsa-serviceworker-init to `true`
        // we allow those requests to prevent them to pollute the ddos-list
        // because there might be a lot at startup, depending on the cache
        // but note, that ONLY the amount of cachelist items is allowed
        if (request.headers['x-itsa-serviceworker-init']==='true') {
            if (instance.allowedServiceworkerRequest(address)) {
                if (!params.silent) {
                    console.log('allowed serviceworker request', request.path);
                }
                return {ok: true};
            }
            if (!params.silent) {
                console.warn('overloaded serviceworker request', request.path);
            }
        }
        if (params.includeUserAgent) {
            address += '#'+request.headers['user-agent'];
        }
        if (!params.silent) {
            console.warn('ddos prevention update status because of:', request.path);
        }
        if (!table[address]) {
            table[address] = {count: 1, expiry: 1};
        }
        else {
            if (table[address].count<=params.limit) {
                table[address].count++;
            }
            if (table[address].count>params.maxItemsOnPage) {
                if (table[address].expiry<params.maxexpiry) {
                    table[address].expiry = Math.min(params.maxexpiry, table[address].expiry * 2);
                }
            }
            else {
                table[address].expiry = 1;
            }
        }
        if (!params.silent) {
            console.warn('ddos prevention new status:', table[address]);
        }
        if (table[address].count>params.limit) {
            if (!params.silent && !params.testmode) {
                console.log('ddos prevention denied entry:', address, table[address]);
            }
            else if (params.logBlocked) {
                console.log('ddos prevention:', request.path, 'denied for', address, table[address]);
            }
            if (params.testmode) {
                console.log('ddos prevention would deny entry:', address, table[address]);
                returnObject = {ok: true};
            }
            else {
                returnObject = {message: params.errormessage, statusCode: params.responseStatus};
            }
        }
        else {
            returnObject = {ok: true};
        }
        if (!params.silent) {
            console.log('ddos-prevention end handle', table);
        }
        return returnObject;
    },
    destroy: function() {
        const instance = this;
        instance._timer.cancel();
        instance._timerSW.cancel();
    }
});

module.exports = Ddos;
