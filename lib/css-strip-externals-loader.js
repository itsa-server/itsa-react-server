/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

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
