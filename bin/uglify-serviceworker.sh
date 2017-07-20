#!/bin/bash

# run this file whenever ../lib/serviceworker/serviceworker.js is changed --> it will create the minified file
uglifyjs --compress drop_console --mangle --output ../lib/serviceworker/serviceworker.min.js -- ../lib/serviceworker/serviceworker.js
