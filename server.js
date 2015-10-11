"use strict";

var handlebars = require('handlebars'),
    filerequest = require('request'),
    HELPER_REGEXP = /(.+)\.hb$/,
    PARTIAL_REGEXP = /(.+)\.html$/,
    DEFAULT_CONFIG = { // should be the same as within module `inline-script-css`
        inline: 'js,css',
        minify: true,
        renderitags: true,
        debug: false
    },
    Good, GoodConsole, Path, fsp, appInit, itsaServerRenderer, UglifyJS,
    helpersRegistered, partialsRegistered, handlebarsReady, Threads, createDir, workingdir,
    suppressLogging, generateView, control, sendFile, itsaServerPlugin, generateJSFiles, jsFilesGenerated, fileUploadHandler;

suppressLogging = require('suppress-logging');
// suppressLogging.log(false);

require('js-ext/js-ext.js'); // full version

fsp = require('fs-promise');
require('fs-extra');
Good = require('good');
GoodConsole = require('good-console');
Path = require('path');
UglifyJS = require("uglify-js");

// webworkers require nodejs version 0.8.0 with node-gyp and python v2.7
// Threads = require('webworker-threads');

itsaServerRenderer = require('inline-script-css');

workingdir = process.cwd(); // without end-slash

    createDir = function(directory) {
        return fsp.exists(directory).then(function(exists) {
            if (!exists) {
                return fsp.mkdirs(directory);
            }
        });
    };

    appInit = function(env) {
        var hash = [],
            appConfig = fsp.readJSON(workingdir+'/application.json'),
            packageConfig = fsp.readJSON(workingdir+'/package.json');
        hash.push(appConfig);
        hash.push(packageConfig);
        return Promise.finishAll(hash).then(
            function(result) {
                var applicationConfig, packageConfig;
                if (result.rejected[0]!==undefined) {
                    throw new Error('invalid application.json');
                }
                if (result.rejected[1]!==undefined) {
                    throw new Error('invalid application.json');
                }
                applicationConfig = result.fulfilled[0];
                packageConfig = result.fulfilled[1];
                jsFilesGenerated = generateJSFiles(applicationConfig.environments[env], packageConfig); // no need to wait --> router waits for it when needed
                return {
                    applicationConfig: applicationConfig,
                    packageConfig: packageConfig
                };
            }
        );
    };

    helpersRegistered = function(path) {
        return fsp.readdir(path).then(function(files) {
            files.forEach(function(filename) {
                var match = filename.match(HELPER_REGEXP),
                    helperName = match[1];
                if (helperName) {
                    handlebars.registerHelper(helperName, require(path+'/'+filename));
                }
            });
        });
    };

    partialsRegistered = function(path) {
        return fsp.readdir(path).then(function(files) {
            var partialsArray = [];
            files.forEach(function(filename) {
                var match = filename.match(PARTIAL_REGEXP),
                    partialName = match[1];
                if (partialName) {
                    partialsArray.push(
                        fsp.readFile(path+'/'+filename, 'utf8').then(function(filecontent) {
                            handlebars.registerPartial(partialName, filecontent);
                        })
                    );
                }
            });
            return Promise.all(partialsArray);
        });
    };

    handlebarsReady = function(partialsPath, helpersPath) {
        return Promise.all([
            helpersRegistered(helpersPath),
            partialsRegistered(partialsPath)
        ]).catch(function(err) {
            console.log(err);
        });
    };

    /**
     * Generates the folders:
     *
     * /assets/js_combined
     * /assets/js_combined_min
     * /assets/js_min
     *
     * Also generates all js-files into combined and minified versions from the `/assets/js` folder
     * into the three created folders
     */
    generateJSFiles = function(config, packageConfig) {
        var dir = workingdir+'/assets/js/',
            combinedDir = Path.join(__dirname, 'assets/js_combined/'),
            combinedDirMin = Path.join(__dirname, 'assets/js_combined_min/'),
            dirMin = Path.join(__dirname, 'assets/js_min/'),
            handlebarsPath = workingdir+'/pages',
            partialsPath = workingdir+'/partials',
            helpersPath = workingdir+'/handlebar_helpers',
            hash = [],
            appConfig = DEFAULT_CONFIG,
            createCombined, createMinfied;

        appConfig.merge(config, {force: true});

        createCombined = function(destinationDir) {
            return handlebarsReady(partialsPath, helpersPath).then(function() {
                return fsp.readdir(handlebarsPath).then(function(files) {
                    var handlebarsArray = [],
                        match, partialName;
                    files.forEach(function(filename) {
                        match = filename.match(PARTIAL_REGEXP);
                        partialName = match[1];
                        if (partialName) {
                            handlebarsArray.push(
                                (function(partial) {
                                    return fsp.readFile(handlebarsPath+'/'+filename, 'utf8').then(function(template) {
                                        // create a new RegExp object, because another request might be looping at the same time
                                        var REGEXP_JS = new RegExp('<script(?:.+)src="(.+)"(?:.*)><\/script>', 'gi'),
                                            // the content needs to be parsed by handlebars and run with an empty object as context:
                                            fileContent = handlebars.compile(template)({}),
                                            hash = [],
                                            matches, index, jsFilename, length;

                                        while ((matches=REGEXP_JS.exec(fileContent))!==null) {
                                            index = matches.index;
                                            jsFilename = matches[1];
                                            // do not replace the framework: it is too large,
                                            // we prefer a smaller download which is on the screen right away
                                            if ((jsFilename!=='/itagsbuild.js') && (jsFilename!=='/itagsbuild-min.js')) {
                                                if (!jsFilename.startsWith('http://', true) && !jsFilename.startsWith('https://', true)) {
                                                    // local file
                                                    jsFilename = 'http://localhost:'+appConfig.port+jsFilename;
                                                }
                                                length = matches[0].length;
                                                fileContent = fileContent.substr(0, index) + fileContent.substr(index+length);
                                                REGEXP_JS.lastIndex = index; // prevent missing adjecent link-tag
                                                // now load the js file inside a Promise. When ready, add the loaded content:
                                                // be careful passing through `tempReplacement` --> we don't want all promises having its last value:
/*jshint -W083 */
                                                (function(jsfile) {
/*jshint +W083 */
                                                    hash.push(new Promise(function(fulfill) {
                                                        filerequest.get(jsfile, function (error, response, body) {
                                                            if (!error && response.statusCode === 200) {
                                                                fulfill(body);
                                                            }
                                                            else {
                                                                // error: fulfill by added comment
                                                                console.log(error);
                                                                fulfill('<!-- error loading js-file: '+jsfile+' -->');
                                                            }
                                                        });
                                                    }));
                                                }(jsFilename));
                                            }
                                        }
                                        return Promise.finishAll(hash);
                                    }).then(function(result) {
                                        var fulfilled = result.fulfilled,
                                            content;
                                        content = 'window._ITSAexecutedScripts || (window._ITSAexecutedScripts={});';
                                        content += 'window._ITSAscriptCombined = function() {\n\n';
                                        fulfilled.forEach(function(filecontent) {
                                            content += '\n\n'+filecontent+'\n\n';
                                        });
                                        content += '};\n\n';
                                        content += 'window._ITSAexecutedScripts.models && window._ITSAscriptCombined();\n\n';
                                        return fsp.writeFile(destinationDir+'/page_'+partial+'.'+packageConfig.version+'.js', content, {encoding: 'utf8'});
                                    }).catch(function(err) {
                                        console.log(err);
                                    });
                                }(partialName))
                            );
                        }
                    });
                    return Promise.all(handlebarsArray);
                });
            }).catch(function(err) {
                console.log(err);
            });
        };
        createMinfied = function(sourceDir, destinationDir) {
            // because uglify takes a long time, we need a thread-worker:
            var createWorkerPromise = function(source, destination) {
                return new Promise(function(fulfill, reject) {
                    var worker, result;
                    if (Threads) {
                        worker = new Threads.Worker(function(){
                            postMessage(UglifyJS.minify(source, {
                                mangle: true,
                                ascii_only: true,
                                beautify: false,
                                compress: {
                                    drop_debugger: true,
                                    drop_console: true,
                                    // sequences: true,
                                    // dead_code: true,
                                    // conditionals: true,
                                    // booleans: true,
                                    // unused: true,
                                    // if_return: true,
                                    // join_vars: true,
                                    warnings: false
                                }
                            }));
                        });
                        worker.onmessage = function (resultcode) {
                            fsp.writeFile(destination, resultcode, {encoding: 'utf8'}).then(fulfill, reject);
                            worker.terminate();
                        };
                    }
                    else {
                        result = UglifyJS.minify(source, {
                            mangle: true,
                            ascii_only: true,
                            beautify: false,
                            compress: {
                                drop_debugger: true,
                                drop_console: true,
                                // sequences: true,
                                // dead_code: true,
                                // conditionals: true,
                                // booleans: true,
                                // unused: true,
                                // if_return: true,
                                // join_vars: true,
                                warnings: false
                            }
                        });
                        fsp.writeFile(destination, result.code, {encoding: 'utf8'}).then(fulfill, reject);
                    }
                });
            };
            return fsp.readdir(sourceDir).then(function(files) {
                var hash = [];
                files.forEach(function(filename) {
                    var pos, destFileName;
                    pos = filename.lastIndexOf('.');
                    destFileName = filename.substr(0, pos)+'-min'+filename.substr(pos);
                    hash.push(createWorkerPromise(sourceDir+filename, destinationDir+destFileName).catch(function(err) {console.log(err);throw(err);}));
                });
                return Promise.finishAll(hash);
            }).catch(function(err) {
                console.log(err);
            });
        };
        hash.push(fsp.emptyDir(combinedDir));
        hash.push(fsp.emptyDir(combinedDirMin));
        hash.push(fsp.emptyDir(dirMin));
        return Promise.finishAll(hash).then(function() {
            hash.length = 0; // reuse
            hash.push(createCombined(combinedDir).catch(function(err) {
                console.log(err);
            }).finally(function() {
                return createMinfied(combinedDir, combinedDirMin);
            }));
            hash.push(createMinfied(dir, dirMin));
            return Promise.finishAll(hash).then(function() {
                console.log('ready generateJSFiles');
            });
        }).catch(function(err) {
            console.log(err);
        });
    };

    generateView = function(viewName, request, reply) {
        fsp.exists(workingdir+'/models/'+viewName+'.js').then(
            function(exists) {
                var viewModule;
                if (!exists) {
                    throw new Error('model not found');
                }
                viewModule = require(workingdir+'/models/'+viewName+'.js');
                if (!viewModule) {
                    throw new Error('model not found');
                }
                if (typeof viewModule.html!=='function') {
                    throw new Error('invalid model-structure: no method "html" found');
                }
                return viewModule.html(request).then(
                    function(data) {
                        console.log('reading modeldata/models/'+viewName+'.js');
                        console.log('generate view: /pages/'+viewName+'.html');
                        // merging:
                        //  payload - maps to request.payload.
                        //  params - maps to request.params.
                        //  query - maps to request.query.
                        //  pre - maps to request.pre.
                        data.merge({
                            payload: request.payload,
                            params: request.params,
                            query: request.query,
                            pre: request.pre
                        });
                        reply.view(viewName, data);
                    }
                );
            }
        ).catch(function(err) {
            if (err.message!=='model not found') {
                console.log(err);
            }
            console.log('generate view: /pages/'+viewName+'.html without modeldata');
            reply.view(viewName);
        });
    };

    control = function(module, method, request, reply) {
        var args = arguments,
            shift = Array.prototype.shift;
        return fsp.exists(workingdir+'/controllers/'+module+'.js').then(
            function(exists) {
                var controllerModule;
                if (!exists) {
                    throw new Error('controllers/'+module+'.js does not exist');
                }
                controllerModule = require(workingdir+'/controllers/'+module+'.js');
                if (typeof controllerModule[method]!=='function') {
                    throw new Error('Controller '+module+' has no method '+method);
                }
                shift.call(args);
                shift.call(args);
                return controllerModule[method].apply(controllerModule, args);
            }
        ).catch(function(err) {
            var errDesc = 'server error';
            console.log(err);
            reply(new Error(errDesc));
        });
    };

    sendFile = function(filename, reply, waitForFile) {
        if (waitForFile) {
            jsFilesGenerated.then(function() {
                reply.file(filename);
            });
        }
        else {
            reply.file(filename);
        }
    };

itsaServerPlugin = {
    register: function (globalServer, options, next) {
        var server = globalServer.root;
        options || (options={});
        fileUploadHandler = require('file-upload-handler')(options.tmpDir, options.maxUploadSize, options.nsClientId);
        options.environment = process.argv[2] || 'master';
        server.sendFile = sendFile;
        server.recieveFile = fileUploadHandler.recieveFile;
        server.generateClientId = fileUploadHandler.generateClientId;
        server.control = control;
        server.generateView = generateView;

        appInit(options.environment).then(
            function(config) {
                var envConfig = config.applicationConfig.environments[options.environment],
                    packageConfig = config.packageConfig,
                    routes = [];
                // when debuggin: plugin the Good-plugin
                if (envConfig.debug) {
                    suppressLogging.log(true);
                    server.register({
                        register: Good,
                        options: {
                            reporters: [{
                                reporter: GoodConsole,
                                args:[{ log: '*', response: '*' }]
                            }]
                        }
                    },
                    function(err) {
                        if (err) {
                            throw err; // something bad happened loading the plugin
                        }
                    });
                }

                server.connection({
                    host: 'localhost',
                    port: envConfig.port
                });

                server.views({
                    engines: {
                        html: itsaServerRenderer(envConfig, packageConfig)
                    },
                    path: Path.join(workingdir, './pages'),
                    partialsPath: Path.join(workingdir, './partials'),
                    helpersPath: Path.join(workingdir, './handlebar_helpers')
                });

                routes.push({
                    method: 'GET',
                    path: '/{scriptfile}.js',
                    handler: function (request, reply) {
                        var scriptfile = request.params.scriptfile,
                            isMinified = scriptfile.endsWith('-min', true),
                            minifiedExtention = isMinified ? '_min' : '';
                        server.sendFile(workingdir+'/assets/js'+minifiedExtention+'/'+scriptfile+'.js', reply, isMinified);
                    }
                });

                routes.push({
                    method: 'GET',
                    path: '/library/{scriptfile}.js',
                    handler: function (request, reply) {
                        var scriptfile = request.params.scriptfile,
                            isMinified = scriptfile.endsWith('-min', true),
                            dotIndex = scriptfile.indexOf('.'),
                            libraryFile = scriptfile.substr(0, dotIndex)+(isMinified ? '-min' : '')+'.js';
                        server.sendFile(Path.join(__dirname,'assets/library/'+libraryFile), reply);
                    }
                });

                routes.push({
                    method: 'GET',
                    path: '/combined/{scriptfile}.js',
                    handler: function (request, reply) {
                        var scriptfile = request.params.scriptfile,
                            isMinified = scriptfile.endsWith('-min', true),
                            minifiedExtention = isMinified ? '_min' : '';
                        server.sendFile(Path.join(__dirname,'assets/js_combined'+minifiedExtention+'/'+scriptfile+'.js'), reply, true);
                    }
                });

                routes.push({
                    method: 'GET',
                    path: '/favicon.ico',
                    handler: function (request, reply) {
                        server.sendFile(workingdir+'/assets/favicon.ico', reply);
                    }
                });

                // leave this at the bottom, for it returns the func
                if (envConfig.sass) {
                    server.route(routes);
                    // wait for register to finish
                    return new Promise(function(fulfill, reject) {
                        server.register({
                            register: require('hapi-sass'), // do not set this on top --> some environments cannot load hapi-sass because they fail /lib64/libc.so.6: version `GLIBC_2.14'
                            options: {
                              debug: envConfig.debug,
                              force: envConfig.debug,
                              src: workingdir+'/assets/scss',
                              outputStyle: 'compressed',
                              sourceComments: envConfig.debug,
                              dest: workingdir+'/assets/css_rendered',
                              routePath: '/{file}.css',
                              includePaths: [workingdir+'/assets/scss']
                            }
                        },
                        function(err) {
                            if (err) {
                                reject(err); // something bad happened loading the plugin
                            }
                            else {
                                fulfill();
                            }
                        });
                    });
                }
                else {
                    routes.push({
                        method: 'GET',
                        path: '/{cssfile}.css',
                        handler: function (request, reply) {
                            server.sendFile(workingdir+'/assets/css_rendered/'+request.params.cssfile+'.css', reply);
                        }
                    });
                    server.route(routes);
                }
            }
        ).catch(function(err) {
            suppressLogging.log(true);
            console.log(err);
        }).finally(next);
    }
};

itsaServerPlugin.register.attributes = {
    pkg: require(workingdir+'/package.json')
};

module.exports = itsaServerPlugin;