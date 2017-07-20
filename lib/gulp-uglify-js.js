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
    uglify = require('gulp-uglify');

gulp.task('component:uglifyjs', () => {
    const sourceDir = './build/private/**/*.js',
        destDir = './build/private/';

    return gulp.src([sourceDir])
        .pipe(uglify())
        .pipe(gulp.dest(destDir));
});
