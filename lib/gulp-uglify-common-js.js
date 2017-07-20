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
    uglify = require('gulp-uglify'),
    findPackageVersion = require('./find-package-version');

gulp.task('component:uglifycommonjs', () => {
    const version = findPackageVersion.getVersion(),
        sourceDir = './build/public/assets/'+version+'/_itsa_server_commons/*.js',
        destDir = './build/public/assets/'+version+'/_itsa_server_commons/';

    return gulp.src([sourceDir])
        .pipe(uglify())
        .pipe(gulp.dest(destDir));
});
