/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/

var cordova_util = require('./util'),
    ConfigParser = require('cordova-common').ConfigParser,
    path         = require('path'),
    Q            = require('q'),
    fs           = require('fs'),
    events       = require('cordova-common').events,
    cordova      = require('./cordova'),
    semver      = require('semver'),
    promiseutil = require('../util/promise-util');

exports.installPluginsFromConfigXML = installPluginsFromConfigXML;
exports.installPlatformsFromConfigXML = installPlatformsFromConfigXML;

function installPlatformsFromConfigXML(platforms, opts) {
    events.emit('verbose', 'Checking config.xml and package.json for saved platforms that haven\'t been added to the project');

    var projectHome = cordova_util.cdProjectRoot();
    var configPath = cordova_util.projectConfig(projectHome);
    var cfg = new ConfigParser(configPath);
    var engines = cfg.getEngines();
    var pkgJsonPath = path.join(projectHome,'package.json');
    var pkgJson;
    var pkgJsonPlatforms;
    var comboArray = []; 
    var targets;
    var configPlatforms = [];
    var installAllPlatforms;
    var platformPath;
    var platformAlreadyAdded;
    var t;
    // var ConfigAndPkgJsonArray = [];
    var modifiedPkgJson = false;
    var modifiedConfigXML = false;
    // var targetPlatformsArray = [];

    if(fs.existsSync(pkgJsonPath)) {
        pkgJson = require(pkgJsonPath);
    }
    if(pkgJson !== undefined && pkgJson.cordova !== undefined && pkgJson.cordova.platforms !== undefined) {
        pkgJsonPlatforms = pkgJson.cordova.platforms;
    } 
    
    if(cfg !== undefined) {
        //this is useless 64-80
        /*
        configPlatforms = [];
        engines = cfg.getEngines(projectHome);
        installAllPlatforms = !platforms || platforms.length === 0;
        targets = engines.map(function(engine) {
            platformPath = path.join(projectHome, 'platforms', engine.name);
            platformAlreadyAdded = fs.existsSync(platformPath);
            // If no platforms are specified we add all.
            if ((installAllPlatforms || platforms.indexOf(engine.name) > -1) && !platformAlreadyAdded) {
                t = engine.name;
                if (engine.spec) {
                    //t += '@' + engine.spec;
                    configPlatforms.push(t);
                }
                return t;
            }
        });*/

        if (pkgJsonPlatforms !== undefined) {
            // Combining arrays and checking duplicates
            comboArray = pkgJsonPlatforms.slice();
        }
        
        engines = cfg.getEngines(projectHome)
        configPlatforms = engines.map(function(Engine) {
            t = Engine.name;
            return t;
        });
        
        configPlatforms.forEach(function(item) {
            if(comboArray.indexOf(item) < 0 ) {
                comboArray.push(item);
            }
        });
        //comboArray should have all platforms from config.xml & package.json
        //remove dupes in comboArray & sort
        var uniq = comboArray.reduce(function(a,b) {
            if (a.indexOf(b) < 0 ) a.push(b);
                return a;
        },[]);
        comboArray = uniq;
        comboArray = comboArray.sort();

        // No platforms to restore from either config.xml or package.json
        if (comboArray.length <= 0) {
           return Q('No platforms found in config.xml or package.json. Nothing to restore');
        }

        //if no package.json, don't bother
        if (pkgJson !== undefined) { 
            // If config.xml & pkgJson exist and the cordova key is undefined, create a cordova key.
            if (pkgJson.cordova === undefined) {
                pkgJson.cordova = {};
            }
            // If there is no platforms array, create an empty one.
            if (pkgJson.cordova.platforms === undefined) {
                pkgJson.cordova.platforms = [];
            }
            // If comboArray has the same platforms as pkg.json, no modification to pkg.json.
            if (comboArray.toString() === pkgJson.cordova.platforms.sort().toString()) {
                events.emit('verbose', 'Config.xml and package.json platforms are the same. No pkg.json modification.');
            } else {
                // modify pkg.json to include the elements
                // from the comboArray array so that the arrays are identical
                events.emit('verbose', 'Config.xml and package.json platforms are different. Updating package.json with most current list of platforms.');
                modifiedPkgJson = true;
            }

            // If comboArray has the same platforms as config.xml, no modification to config.xml.
            if(comboArray.length === configPlatforms.length && comboArray.toString() === configPlatforms.sort().toString()) {
                events.emit('verbose', 'Package.json and config.xml are the same. No config.xml modification.');
            } else {
                events.emit('verbose', 'Package.json and config.xml platforms are different. Updating config.xml with most current list of platforms.');
                comboArray.forEach(function(item) {
                    if(configPlatforms.indexOf(item) < 0 ) {
                        cfg.addEngine(item);
                        modifiedConfigXML = true;
                    }
                });
            }
        }


        // Write and update pkg.json if it has been modified.
        if (modifiedPkgJson === true) {
            pkgJson.cordova.platforms = comboArray;
            fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 4), 'utf8');
        }
        if (modifiedConfigXML === true) {
            configPlatforms = comboArray;
            cfg.write();
        }
        if (!comboArray || !comboArray.length) {
            return Q('No platforms found in config.xml and/or package.json that haven\'t been added to the project');
        }
    }
    // Run `platform add` for all the platforms separately
    // so that failure on one does not affect the other.

    // CB-9278 : Run `platform add` serially, one platform after another
    // Otherwise, we get a bug where the following line: https://github.com/apache/cordova-lib/blob/0b0dee5e403c2c6d4e7262b963babb9f532e7d27/cordova-lib/src/util/npm-helper.js#L39
    // gets executed simultaneously by each platform and leads to an exception being thrown
    return promiseutil.Q_chainmap_graceful(comboArray, function(target) {
        if (target) {
            events.emit('log', 'Discovered platform \"' + target + '\" in config.xml or package.json. Adding it to the project');
            return cordova.raw.platform('add', target, opts);
        }
        return Q();
    }, function(err) {
        events.emit('warn', err);
    });
}

//returns a Promise
function installPluginsFromConfigXML(args) {
    events.emit('verbose', 'Checking config.xml for saved plugins that haven\'t been added to the project');
    //Install plugins that are listed on config.xml
    var projectRoot = cordova_util.cdProjectRoot();
    var configPath = cordova_util.projectConfig(projectRoot);
    var cfg = new ConfigParser(configPath);
    var plugins_dir = path.join(projectRoot, 'plugins');
    var pkgJsonPath = path.join(projectRoot,'package.json');
    var pkgJson;
    var pkgJsonPluginIdArray = [];
    var comboPluginArray;

    // Get all configured plugins
    var pluginIdConfig = cfg.getPluginIdList();

    //Check if path exists and require pkgJsonPath
    if(fs.existsSync(pkgJsonPath)) {
        pkgJson = require(pkgJsonPath);
    }
    if (pkgJson.cordova === undefined) {
        pkgJson.cordova = {};
    }
    // (In pkg.json), if there is a platforms array and not plugins array, create a new pluginIdConfig array 
    // and add all plugins from config.xml to the new plugins array.
    if (cfg !== undefined && pkgJson !== undefined && pkgJson.cordova.platforms !== undefined && 
    pkgJson.cordova.plugins === undefined) {
        pkgJson.cordova.plugins = {};
        pluginIdConfig.forEach(function(foo) {
            pkgJson.cordova.plugins[foo] = {};
        });
        console.log('writing 3')
        fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 4), 'utf8');
    }
    // (In pkg.json), if there is no platforms array and no plugins array, create a new plugins array
    // and add all plugins from config.xml to the new plugins array.
    if (cfg !== undefined && pkgJson !== undefined && pkgJson.cordova.platforms === undefined && 
    pkgJson.cordova.plugins === undefined) {
        pkgJson.cordova.platforms = [];
        pkgJson.cordova.plugins = {};
        pluginIdConfig.forEach(function(foo) {
            pkgJson.cordova.plugins[foo] = {};
        });
        console.log('writing 4')
        fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 4), 'utf8');
    }

    pkgJsonPluginIdArray = Object.keys(pkgJson.cordova.plugins);

    // audrey delete?
    // var pluginNames = pluginIdConfig.map(function(elem) {
    //     return elem.name;
    // });

    // Create a merged plugin data array (mergedPluginDataObj)
    // and add all of the package.json plugins to mergedPluginDataObj
    var mergedPluginDataObj = pkgJson.cordova.plugins;
    // Audrey
    // var mergedPluginDataArray = pkgJsonPluginIdArray;

    // Check to see which plugins are initially the same in pkg.json and config.xml
    // Merge identical plugins and their variables together first
    for (var i = 0; i < pkgJsonPluginIdArray.length; i++) {
        if(pluginIdConfig.includes(pkgJsonPluginIdArray[i])) {
            var configPlugin = cfg.getPlugin(pkgJsonPluginIdArray[i]);
            var configPluginVariables = configPlugin.variables;
            var pkgJsonPluginVariables = mergedPluginDataObj[pkgJsonPluginIdArray[i]];
            for(var key in configPluginVariables) {
                // Handle conflicts, package.json wins
                if(pkgJsonPluginVariables[key] === undefined) {
                    pkgJsonPluginVariables[key] = configPluginVariables[key];
                    mergedPluginDataObj[pkgJsonPluginIdArray[i]][key] = configPluginVariables[key];
                }
            }
        }
    }
    // Check to see if pkg.json plugin(id) and config plugin(id) match
    if(pkgJsonPluginIdArray.sort().toString() !== pluginIdConfig.sort().toString() || pluginIdConfig === []) {
        // If there is a config plugin that does NOT already exist in
        // mergedPluginDataArray, add it and its variables
        pluginIdConfig.forEach(function(item) {
            if(pkgJsonPluginIdArray.indexOf(item) < 0) {
                pkgJsonPluginIdArray.push(item);
                var configXMLPlugin = cfg.getPlugin(item);
                mergedPluginDataObj[item] = configXMLPlugin.variables;
            }
        });
    }
    // Write to pkg.Json
    pkgJson.cordova.plugins = mergedPluginDataObj;
    // Audrey... Do I need to check anything before writing?
    // TODO: toString comparision to see if they have the same plugins/variables
    console.log('writing 5')
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 4), 'utf8');
    
    // Write config.xml
    pkgJsonPluginIdArray.forEach(function(plugID) {
        cfg.removePlugin(plugID);
        cfg.addPlugin({name:plugID}, mergedPluginDataObj[plugID]); 
    });
    cfg.write();

    // If config.xml and pkg.json exist and both already contain plugins, run cordova prepare
    // to check if these plugins are identical.
    if(cfg !== undefined && pkgJson.cordova.plugins !== undefined) {
        if(pkgJsonPluginIdArray.toString() === pluginIdConfig.toString() && pkgJsonPluginIdArray.length === pluginIdConfig.length) {
            events.emit('verbose', 'Config.xml and pkgJson plugins are the same. No pkg.json or config.xml modification.');
        }
        if(pkgJsonPluginIdArray.toString() !== pluginIdConfig.toString() || pkgJsonPluginIdArray.length !== pluginIdConfig.length) {
           events.emit('verbose', 'Config.xml and pkgJson plugin names are different.');
            // Combining arrays and checking duplicates
            comboPluginArray = pkgJsonPluginIdArray.slice();
            pluginIdConfig.forEach(function(item) {
                if(comboPluginArray.indexOf(item) < 0) {
                    comboPluginArray.push(item);
                }
            });
        }
    }
    // Intermediate variable to store current installing plugin name
    // to be able to create informative warning on plugin failure
    var pluginName;

    // CB-9560 : Run `plugin add` serially, one plugin after another
    // We need to wait for the plugin and its dependencies to be installed
    // before installing the next root plugin otherwise we can have common
    // plugin dependencies installed twice which throws a nasty error.
    return promiseutil.Q_chainmap_graceful(pluginIdConfig, function(featureId) {
        var pluginPath = path.join(plugins_dir, featureId);
        if (fs.existsSync(pluginPath)) {
            // Plugin already exists
            return Q();
        }
        events.emit('log', 'Discovered plugin "' + featureId + '" in config.xml. Adding it to the project');
        var pluginEntry = cfg.getPlugin(featureId);

        // Install from given URL if defined or using a plugin id. If spec isn't a valid version or version range,
        // assume it is the location to install from.
        var pluginSpec = pluginEntry.spec;
        pluginName = pluginEntry.name;

        // CB-10761 If plugin spec is not specified, use plugin name
        var installFrom = pluginSpec || pluginName;
        if (pluginSpec && semver.validRange(pluginSpec, true))
            installFrom = pluginName + '@' + pluginSpec;

        // Add feature preferences as CLI variables if have any
        var options = {
            cli_variables: pluginEntry.variables,
            searchpath: args.searchpath,
            fetch: args.fetch || false,
            save: args.save || false
        };
        var plugin = require('./plugin');
        return plugin('add', installFrom, options);
    }, function (error) {
        // CB-10921 emit a warning in case of error
        var msg = 'Failed to restore plugin \"' + pluginName + '\" from config.xml. ' +
            'You might need to try adding it again. Error: ' + error;
        events.emit('warn', msg);
    });
}
