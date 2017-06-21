'use strict';

const gulp = require('gulp'),
    uglifycss = require('gulp-uglifycss'),
    findPackageVersion = require('./find-package-version');

gulp.task('component:uglifycommoncss', () => {
    const version = findPackageVersion.getVersion(),
        sourceDir = './build/public/assets/'+version+'/_itsa_server_commons/*.css',
        destDir = './build/public/assets/'+version+'/_itsa_server_commons/';

    return gulp.src([sourceDir])
        .pipe(uglifycss({
            uglyComments: true
        }))
        .pipe(gulp.dest(destDir));
});
