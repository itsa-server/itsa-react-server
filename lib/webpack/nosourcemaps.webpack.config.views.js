'use strict';

let config = require('../../../../webpack.config.views') || {};
delete config.devtool;

module.exports = config;
