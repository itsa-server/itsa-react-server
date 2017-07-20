#!/bin/bash

# run this file whenever ../lib/serviceworker/serviceworker.js is changed --> it will create the minified file
uglifyjs --compress drop_console --mangle --output ../lib/polyfills/request-animation-frame.min.js -- ../lib/polyfills/request-animation-frame.js
