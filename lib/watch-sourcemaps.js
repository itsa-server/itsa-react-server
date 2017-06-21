'use strict';

(function(args) {
    const watchBase = require('./webpack/watch-base');
    watchBase(true, args);
}(process.argv));
