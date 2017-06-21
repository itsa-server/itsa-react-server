'use strict';

let config = require('../../../../webpack.config.chunks') || {};
delete config.devtool;

module.exports = config;
