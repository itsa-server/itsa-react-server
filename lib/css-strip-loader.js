'use strict';

module.exports = function() {
    this.cacheable && this.cacheable();
    return '';
};