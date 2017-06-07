'use strict';

(function(args){
    const environment = args[2] || 'production';
    require('./build-webpack')(environment==='production');
}(process.argv));
