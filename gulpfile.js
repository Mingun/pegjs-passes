'use strict';

/* eslint-env node */

let gulp  = require('gulp');
let mocha = require('gulp-mocha');
let yargs = require('yargs');

const TEST_FILES = [
  'test/**/*.js'
];

// Run tests.
gulp.task('test', function() {
  gulp.src(TEST_FILES, { read: false })
      .pipe(mocha({ grep: yargs.argv.grep }))
});

// Default task.
gulp.task('default', ['test']);
