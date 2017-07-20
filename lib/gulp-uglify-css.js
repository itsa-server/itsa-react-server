/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

const gulp = require('gulp'),
    uglifycss = require('gulp-uglifycss');

gulp.task('component:uglifycss', () => {
    const sourceDir = './build/private/**/*.css',
        destDir = './build/private/';

    return gulp.src([sourceDir])
        .pipe(uglifycss({
            uglyComments: true
        }))
        .pipe(gulp.dest(destDir));
});
