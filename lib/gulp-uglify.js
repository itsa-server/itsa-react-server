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
