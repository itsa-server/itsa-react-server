/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

require('./gulp-uglify-common-css');
require('./gulp-uglify-css');
require('./gulp-uglify-common-js');
require('./gulp-uglify-js');

const runSequence = require('run-sequence');

const cb = callback => {
    runSequence(
        'component:uglifycommoncss',
        'component:uglifycss',
        'component:uglifycommonjs',
        'component:uglifyjs',
        function(error) {
            if (error) {
                console.warn(error.message);
                callback(error);
            }
        }
    );
};

module.exports = cb;
