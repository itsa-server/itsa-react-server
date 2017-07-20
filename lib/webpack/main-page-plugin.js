/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

require('itsa-jsext');

const path = require('path'),
    transformData = require('./transform-data'),
    fs = require('fs-extra'),
    cwd = process.cwd();

function ItsaServerMainPagePlugin(type, options) {
    this.type = type;
    this.options = options || {};
    if (this.options.template) {
        // make absolute path
        this.options.template = path.resolve(cwd, this.options.template);
    }
    if (this.options.app) {
        // make absolute path
        this.options.app = path.resolve(cwd, this.options.app);
    }
}

ItsaServerMainPagePlugin.prototype.apply = function(compiler) {
    let entries = {};
    const instance = this,
        entry = compiler.options.entry;

    if (Object.itsa_isObject(entry)) {
        entry.itsa_each((value, key) => entries[path.resolve(cwd, value)]=key);
    }

    compiler.plugin('compile', function(params) {
        const prevReadFile = params.contextModuleFactory.resolvers.context.fileSystem._readFile;
        params.contextModuleFactory.resolvers.context.fileSystem._readFile = function(file, callback) {
            const newCallback = async function(error, data) {
                let view = entries[file],
                    slash;
                if (instance.type==='chunks') {
                    if (!error) {
                        if (view) {
                            slash = view.indexOf('/');
                            if (slash!==-1) {
                                view = view.substr(slash+1);
                            }
                            try {
                                data = await transformData.toChunk(instance.options.template, file, instance.options.app, view, data);
                            }
                            catch (err) {
                                data = '';
                            }
                        }
                    }
                }
                else {
                    if (!error && view) {
                        try {
                            if (instance.type==='views') {
                                data = await transformData.toView(instance.options.template, file, view.itsa_replaceAll('/', '_').itsa_replaceAll('\\\\', '_'), data);
                            }
                            else {
                                data = await transformData.toStaticComponent(file, data);
                            }
                        }
                        catch (err) {
                            data = '';
                        }
                    }
                }
                callback(error, data);
            };
            prevReadFile(file, newCallback);
        };
    });

    if (instance.type==='chunks') {
        /*
         * Creates a map so the client can `webpack-require` the right module
        */
        compiler.plugin('after-compile', function(compilation, cb) {
            const chunkMap = compilation.chunks.map(chunk => {
                    let item = {},
                        entryModule = !!chunk.entryModule,
                        isCommon = !chunk.parents || (chunk.parents.length===0),
                        cssfile, appModule;
                    if (entryModule || isCommon) {
                        if (entryModule) {
                            item.name = chunk.name;
                            item.componentId = chunk.id;
                            item.requireId = chunk.entryModule.id;
                        }
                        else {
                            // find the id of app:
                            item.isCommon = true;
                            appModule = chunk.modules.find(module => module.resource===instance.options.app);
                            if (appModule) {
                                item.requireId = appModule.id;
                            }
                        }
                        item.hash = chunk.renderedHash;
                        if (chunk.files) {
                            // add info about the css file
                            cssfile = chunk.files.find(filename => filename.itsa_endsWith('.css'));
                            if (cssfile) {
                                item.cssfile = cssfile.substr(cssfile.lastIndexOf('/')+1);
                            }
                        }
                    }
                    return item;
                }).filter(item => (item.componentId!==undefined) || item.isCommon),
                // }).filter(item => !!item.requireId || ((instance.type==='views') && !item.parents)),
                destFile = path.resolve(cwd, 'build.tmp/build-stats.json');
            // store the structure so that the webapp can use it:
            Promise.itsa_finishAll([
                fs.writeFile(destFile, JSON.stringify(chunkMap))
            ]).then(() => cb());
        });
    }
};

module.exports = {
    Chunks: ItsaServerMainPagePlugin.bind(null, 'chunks'),
    Views: ItsaServerMainPagePlugin.bind(null, 'views'),
    StaticComponents: ItsaServerMainPagePlugin.bind(null, 'static')
};
