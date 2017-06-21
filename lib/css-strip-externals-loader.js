'use strict';

require('itsa-jsext');

module.exports = function(data) {
    let match;
    this.cacheable && this.cacheable();
    // look if the resource matches an external css
    if (this.query && this.query.externals) {
        match = this.query.externals.find(external => this.resource.itsa_endsWith(external, true));
    }
    return match ? '' : data;
};
