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
