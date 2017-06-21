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
