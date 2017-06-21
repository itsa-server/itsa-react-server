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
