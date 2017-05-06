var path = require('path'),
    fs = require('fs'),
    shell = require('shelljs'),
    rewire = require('rewire'),
    platform = rewire('../src/cordova/platform'),
    plugin = rewire('../src/cordova/plugin'),
    cordova_util = require('../src/cordova/util'),
    prepare = require('../src/cordova/prepare'),
    cordova = require('../src/cordova/cordova').raw,
    platformMetadata = require('../src/cordova/platform_metadata'),
    platforms = require('../src/platforms/platforms'),
    lazy_load = require('../src/cordova/lazy_load'),
    events = require('cordova-common').events,
    metadata = require('../src/plugman/util/metadata'),
    config = require('../src/cordova/config'),
    uninstall = require('../src/plugman/uninstall'),
    plugman = require('../src/plugman/plugman'),
    Q = require('q'),
    superspawn = require('cordova-common').superspawn,
    registry = require('../src/plugman/registry/registry');

var config_xml_path = 'spec-cordova/fixtures/config.xml';
var pinnedAndroidVer = platforms.android.version;
var platformName = 'android';
var platformVersionNew     = '6.0.0';
var platformTgzUrl = 'https://git-wip-us.apache.org/repos/asf?p=cordova-' + platformName + '.git;a=snapshot;h=' + platformVersionNew + ';sf=tgz';

describe('platform add & remove --save flag', function() {
    
    var projectRoot = path.join('some', 'path'),
        windowsPath = path.join(projectRoot,'cordova-windows'),
        platrevert,
        configParserRevert,
        pkgJson = {},
        configEngines = [],
        fetchArgs = [];

    // Mock HooksRunner
    var hooksRunnerMock = {
        fire: function () {
            return Q();
        }
    };

    // Mock Platform Api
    function PlatformApiMock() {}
    PlatformApiMock.createPlatform = function() {
        return Q();
    };
    PlatformApiMock.updatePlatform = function() {
        return Q();
    };

    // Mock cordova-fetch
    var fetchMock = function(target) {
        fetchArgs.push(target);
        //return the basename of either the target, url or local path 
        return Q(path.basename(target));
    };

    // Mock ConfigParser
    function ConfigParserMock() {}
    ConfigParserMock.prototype = {
        write: function() {
            //do nothing
        },
        addEngine: function(plat, spec) {
            //add engine to configEngines
            configEngines.push({'name': plat, 'spec': spec});
        },
        removeEngine: function(plat) {
            //delete engine from configEngines
            configEngines.forEach(function(item, index) {
                if(item.name === plat){
                    delete configEngines[index]; 
                }
            });
        },
        getEngines: function() {
            return configEngines;
        }
    };

    function getPlatformDetailsFromDirMock(dir, platform) {
        var ver;
        var parts = dir.split('@');
        //attempt to derive version from dir/target
        //eg dir = android@~6.1.1 || atari@1.0.0
        if(parts.length > 1) {
            ver = parts[1] || parts[0];
            //remove ~ or ^ since the real function version wouldn't have that
            if(ver[0] === '~' || ver[0] === '^') {
                ver = ver.slice(1);
            }
        }
        // not a perfect representation of the real function, but good for testing
        return Q({
            'libDir':'Api.js',
            'platform':platform || path.basename(dir),
            'version':ver || 'n/a'
        });
    }

    beforeEach(function() {
        spyOn(cordova_util, 'projectConfig').and.returnValue(config_xml_path);
        spyOn(shell, 'mkdir').and.returnValue(true);
        platrevert = platform.__set__('fetch', fetchMock);
        
        configParserRevert = platform.__set__('ConfigParser', ConfigParserMock);
        spyOn(platform, 'getPlatformDetailsFromDir').and.callFake(getPlatformDetailsFromDirMock);
        spyOn(prepare, 'preparePlatforms').and.returnValue(Q());
        spyOn(cordova, 'prepare').and.returnValue(Q());
        spyOn(platformMetadata, 'save').and.returnValue(true);
        spyOn(cordova_util, 'getPlatformApiFunction').and.returnValue(PlatformApiMock);
        //writes to package.json
        spyOn(fs, 'writeFileSync').and.callFake(function(dest, pkgJ) {
            pkgJson = JSON.parse(pkgJ);
            return true;
        });

        //return true for windows local path target
        spyOn(cordova_util,'isDirectory').and.callFake(function(filePath) {
            if(filePath.indexOf(windowsPath) !== -1) {
                return true;
            } else {
                return false;
            }
        });

        spyOn(lazy_load, 'git_clone').and.callFake(function(git_url, branch) {
            return Q(path.basename(git_url));
        });
    });

    afterEach(function() {
        platrevert();
        configParserRevert();
        pkgJson = {};
        configEngines = [];
        fetchArgs = [];
    });

    it('should support custom tgz files', function(done) {
        spyOn(lazy_load, 'based_on_config').and.callFake(function(projRoot, target) {
            return Q(target);
        });
        // Spy for package.json to exist.
        spyOn(fs,'existsSync').and.callFake(function(filePath) {
            if(path.basename(filePath) === 'package.json') {
                return true;
            } else {
                return false;
            }
        });
        
        //require packge.json object
        spyOn(cordova_util, 'requireNoCache').and.returnValue(pkgJson);
        
        platform.add(hooksRunnerMock, projectRoot, [platformTgzUrl], {'fetch': true, 'save': true})
        .then(function() {
            // Expect correct arugments to be passed to cordova-fetch.
            expect(fetchArgs[0]).toEqual('https://git-wip-us.apache.org/repos/asf?p=cordova-android.git;a=snapshot;h=6.0.0;sf=tgz');
            // Saved to pkgJson.
            expect(fs.writeFileSync.calls.count()).toEqual(1);
            expect(pkgJson.cordova).toBeDefined();
            expect(pkgJson.cordova.platforms).toEqual([ 'asf?p=cordova-android.git;a=snapshot;h=6.0.0;sf=tgz' ]);
            expect(cordova_util.requireNoCache.calls.count()).toEqual(2);
            // Test cfg.engines code is being run with correct arugments.
            expect(configEngines.length).toEqual(1);
            expect(configEngines).toEqual(
                [ { name: 'asf?p=cordova-android.git;a=snapshot;h=6.0.0;sf=tgz', spec: platformTgzUrl }, ]);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        })
        .fin(done);
    });

    it('should save platform to config.xml', function(done) {
        spyOn(lazy_load, 'based_on_config').and.callFake(function(projRoot, target) {
            return Q(target);
        });
        //spy for package.json to not exist
        spyOn(fs,'existsSync').and.returnValue(false);
        
        //require packge.json object
        spyOn(cordova_util, 'requireNoCache');
    
        platform.add(hooksRunnerMock, projectRoot, [platformName], {'fetch': true, 'save': true})
        .then(function() {
            //expect correct arugments to be passed to cordova-fetch
            expect(fetchArgs).toEqual([ 'cordova-android@~6.2.2' ]);
            // no pkgJson to write to
            expect(fs.writeFileSync.calls.count()).toEqual(0);
            expect(pkgJson.cordova).toBeUndefined();
            expect(cordova_util.requireNoCache.calls.count()).toEqual(0);
            //test cfg.engines code is being run with correct arugments
            expect(configEngines.length).toEqual(1);
            expect(configEngines).toEqual(
                [ { name: platformName, spec: pinnedAndroidVer }, ]);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        })
        .fin(done);
    });

    it('should fail and should not update config if invalid version is specified', function(done) {
        //spy for package.json to not exist
        spyOn(fs,'existsSync').and.returnValue(false);
        spyOn(Q, 'reject').and.callThrough();
        spyOn(cordova_util, 'isUrl').and.callThrough();
        //require packge.json object
        spyOn(cordova_util, 'requireNoCache');
        spyOn(lazy_load, 'based_on_config').and.callThrough();
        platform.add(hooksRunnerMock, projectRoot, ['android@3.969.696'], {'save': true , 'fetch': false})

        .then(function() {
            expect(true).toBe(false);
        }).fail(function(e) {
            expect(e.toString()).toContain('Failed to fetch platform');
        })
        .fin(done);
    });

    it('should save local path as spec if added using only local path', function(done) {
        var windowsPath = path.join(projectRoot,'cordova-windows');
        platform.add(hooksRunnerMock, projectRoot, [windowsPath], { 'save': true })

        .then(function() {
            //test cfg.engines code is being run with correct arugments
            expect(configEngines.length).toEqual(1);
            expect(configEngines).toEqual(
                [ { name: 'cordova-windows', spec: 'some/path/cordova-windows' }, ]);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        })
        .fin(done);
    });

    it('should should not update config or pkgJson if there is no platform in it', function(done) {
        // Spy for package.json to exist.
        spyOn(fs,'existsSync').and.callFake(function(filePath) {
            if(path.basename(filePath) === 'package.json') {
                return true;
            } else {
                return false;
            }
        });
        
        //require packge.json object
        spyOn(cordova_util, 'requireNoCache').and.returnValue(pkgJson);

        platform.add(hooksRunnerMock, projectRoot, [platformName], { 'save': false })
        .then(function() {
            platform.remove(hooksRunnerMock, projectRoot, [platformName], { 'save': true });
            //test cfg.engines code is being run with correct arugments
            expect(configEngines.length).toEqual(0);
            expect(configEngines).toEqual([ ]);
            //test pkgJson is being built correctly
            expect(fs.writeFileSync.calls.count()).toEqual(0);
            expect(pkgJson.cordova.platforms).toEqual([ ]);
            expect(cordova_util.requireNoCache.calls.count()).toEqual(2);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        })
        .fin(done);
    }, 6000);

    it('should remove platform from config and pkgJson', function(done) {
        var HooksRunnerMock = function() {};
        HooksRunnerMock.prototype.fire = function() {return Q(['opts']);};
        platform.__set__('HooksRunner', HooksRunnerMock);
        spyOn(cordova_util, 'cdProjectRoot').and.returnValue('path');
        spyOn(events, 'emit').and.returnValue(true);
        pkgJson = {
            'dependencies': {
                'cordova-android': '^6.2.1'
            },
            'cordova': {
                'platforms': [
                    'android'
                ]
            }
        };

        //spy for package.json to exist
        spyOn(fs,'existsSync').and.callFake(function(filePath) {
            if(path.basename(filePath) === 'package.json') {
                return true;
            } else {
                return false;
            }
        });
        
        //require packge.json object
        spyOn(cordova_util, 'requireNoCache').and.returnValue(pkgJson);

        platform('remove', [platformName], {'save': true})
        .then(function() {
            expect(fs.writeFileSync.calls.count()).toEqual(1);
            expect(events.emit.calls.argsFor(0)[1]).toEqual('Removing platform android from config.xml file...');
            expect(events.emit.calls.argsFor(1)[1]).toEqual('Removing android from cordova.platforms array in package.json');
            expect(events.emit.calls.argsFor(2)[1]).toEqual('Removing platform android from platforms.json file...');
        }).fail(function(e) {
            expect(e).toBeUndefined();
        })
        .fin(done);
    },60000);
});

describe('save unit tests', function() {
    var pkgJson = {};
    var cfgMock = function() {};
    cfgMock.prototype.write = function() {};
    cfgMock.prototype.removePlugin = function() {};
    cfgMock.prototype.getPluginIdList = function() {return ['list'];};

    beforeEach(function() {
        plugin.__set__('ConfigParser', cfgMock);
        spyOn(cordova_util, 'projectConfig').and.returnValue('path');
        spyOn(path, 'join').and.returnValue('path');
        spyOn(fs, 'readFileSync').and.callFake(function(dest, pkgJ) {
            pkgJson = JSON.parse(pkgJ);
            return pkgJson;
        });
        spyOn(JSON, 'parse').and.returnValue('plugins');
        spyOn(Object, 'keys').and.callThrough();
        spyOn(Q, 'reject').and.returnValue(Q());
        spyOn(Q, 'resolve').and.returnValue(Q());
    });

    it('Test 018 : save', function(done) {
        return plugin.save('path', 'options')
        .then(function(){
            expect(cordova_util.projectConfig.calls.count()).toEqual(1);
            expect(path.join.calls.count()).toEqual(1);
            expect(fs.readFileSync.calls.count(1));
            expect(Q.reject.calls.count()).toEqual(0);
            expect(Q.resolve.calls.count()).toEqual(1);
            expect(Object.keys.calls.count()).toEqual(1);
            expect(Object.keys.calls.argsFor(0)).toEqual([ 'plugins' ]);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        })
        .fin(done);
    }, 60000);
});

describe('unit tests for plugin save (add & remove)', function() {
    var pkgJson = 
    { 'name': 'test',
        'version': '1.0.0',
        'description': '',
        'main': 'index.js',
        'scripts': {
        'test': 'echo \'Error: no test specified\' && exit 1'
    },
        'author': '',
        'license': 'ISC',
        'cordova': {
            'plugins': {
                'cordova-plugin-camera': {}
            } 
        }
    };

    var cfgMock = function() {};
    cfgMock.prototype.addPlugin = function() {};
    cfgMock.prototype.getPlugin = function() {};
    cfgMock.prototype.getPluginIdList = function() {return ['list'];};
    cfgMock.prototype.removePlugin = function() {};
    cfgMock.prototype.write = function() {};

    var HooksRunnerMock = function() {};
    HooksRunnerMock.prototype.fire = function() {return Q(['opts']);};

    var getPref = { getPreferences: function(){} };

    var openerMock = function() {};
    openerMock.prototype.opener = function() {return;};

    var plugProviderMock = function() {};
    plugProviderMock.prototype.get = function() {return getPref;};
    plugProviderMock.prototype.getAllWithinSearchPath = function() {return true;};
    plugProviderMock.prototype.getEngines = function() {return;};
    plugProviderMock.prototype.getPreferences = function() {return {};};   

    describe('unit tests for plugin save with remove', function() {

        beforeEach(function() {
            plugin.__set__('HooksRunner', HooksRunnerMock);
            plugin.__set__('ConfigParser', cfgMock);
            spyOn(cordova_util, 'cdProjectRoot').and.callFake(function() {
                return 'some/path';
            });
            spyOn(uninstall, 'uninstallPlugin').and.returnValue(Q());
            spyOn(config,'read').and.returnValue(true);
            spyOn(path, 'join').and.returnValue('some/path');
            spyOn(cordova_util, 'findPlugins').and.returnValue('cordova-plugin-camera');
            spyOn(uninstall, 'uninstallPlatform').and.returnValue(Q());
            spyOn(cordova_util, 'projectConfig').and.returnValue('path');
            spyOn(metadata, 'remove_fetch_metadata').and.returnValue(true);
            spyOn(prepare, 'preparePlatforms').and.returnValue(true);
            spyOn(events, 'emit').and.returnValue(true);
            spyOn(cordova_util, 'requireNoCache').and.callFake(function() {
                return pkgJson;
            });
            spyOn(fs, 'writeFileSync').and.returnValue(true);
        });

        it('Test 001 : remove plugin from config.xml and pkgJson when saved is called and pkgJson exists', function(done) {
            spyOn(cordova_util, 'listPlatforms').and.returnValue([]);
            spyOn(fs, 'existsSync').and.returnValue(true);
            plugin('remove', ['cordova-plugin-camera'], {'save':true})
            .then(function(){
                expect(cordova_util.cdProjectRoot.calls.count()).toEqual(1);
                expect(config.read.calls.count()).toEqual(1);
                expect(cordova_util.findPlugins.calls.count()).toEqual(3);
                expect(cordova_util.listPlatforms.calls.count()).toEqual(1);
                expect(events.emit.calls.count()).toEqual(3);
                // Remove from fetch.json, pkgJson, and config.xml
                expect(events.emit.calls.argsFor(0)[1]).toEqual('Removing plugin cordova-plugin-camera from config.xml file...');
                expect(events.emit.calls.argsFor(1)[1]).toEqual('Removing cordova-plugin-camera from package.json');
                expect(events.emit.calls.argsFor(2)[1]).toEqual('Removing plugin cordova-plugin-camera from fetch.json');
                expect(uninstall.uninstallPlatform.calls.count()).toEqual(0);
                expect(uninstall.uninstallPlugin.calls.count()).toEqual(1);
                // No platform added.
                expect(prepare.preparePlatforms.calls.count()).toEqual(0);
                expect(cordova_util.cdProjectRoot.calls.count()).toEqual(1);
                expect(cordova_util.listPlatforms.calls.count()).toEqual(1);
                expect(cordova_util.projectConfig.calls.count()).toEqual(1);
                expect(cordova_util.requireNoCache.calls.count()).toEqual(1);
                // Should write to package.json
                expect(fs.writeFileSync.calls.count()).toEqual(1);
            }).fail(function(e) {
                expect(e).toBeUndefined();
            }).fin(done);
        });

        it('Test 002 : should successfully remove a plugin & write to config.xml if save is true (no pkgJson in project)', function(done) {
            spyOn(cordova_util, 'listPlatforms').and.returnValue([]);
            spyOn(fs, 'existsSync').and.returnValue(false);
            plugin('remove', ['cordova-plugin-camera'], {'save': true})
            .then(function(){
                // Should remove from config.xml and fetch.json
                expect(events.emit.calls.count()).toEqual(2);
                expect(events.emit.calls.argsFor(0)[1]).toEqual('Removing plugin cordova-plugin-camera from config.xml file...');
                expect(events.emit.calls.argsFor(1)[1]).toEqual('Removing plugin cordova-plugin-camera from fetch.json');
                expect(cordova_util.requireNoCache.calls.count()).toEqual(0);
                // No platform added.
                expect(prepare.preparePlatforms.calls.count()).toEqual(0);
                expect(cordova_util.cdProjectRoot.calls.count()).toEqual(1);
                expect(uninstall.uninstallPlugin.calls.count()).toEqual(1);
                expect(cordova_util.listPlatforms.calls.count()).toEqual(1);
                expect(cordova_util.projectConfig.calls.count()).toEqual(1);
                expect(cordova_util.requireNoCache.calls.count()).toEqual(0);
                // Should not write to package.json
                expect(fs.writeFileSync.calls.count()).toEqual(0);
            }).fail(function(e) {
                expect(e).toBeUndefined();
            }).fin(done);
        });

        it('Test 005 : remove plugin whether there is a platform or not in project', function(done) {
            spyOn(cordova_util, 'listPlatforms').and.returnValue(['ios']);
            spyOn(fs, 'existsSync').and.returnValue(true);
            plugin('remove', ['cordova-plugin-camera'], {'save':true})
            .then(function(){
                expect(cordova_util.cdProjectRoot.calls.count()).toEqual(1);
                expect(config.read.calls.count()).toEqual(1);
                expect(cordova_util.findPlugins.calls.count()).toEqual(3);
                expect(cordova_util.listPlatforms.calls.count()).toEqual(1);
                expect(events.emit.calls.count()).toEqual(4);
                // Remove from fetch.json, pkgJson, and config.xml
                expect(events.emit.calls.argsFor(0)[1]).toEqual('Calling plugman.uninstall on plugin "cordova-plugin-camera" for platform "ios"');
                expect(events.emit.calls.argsFor(1)[1]).toEqual('Removing plugin cordova-plugin-camera from config.xml file...');
                expect(events.emit.calls.argsFor(2)[1]).toEqual('Removing cordova-plugin-camera from package.json');
                expect(events.emit.calls.argsFor(3)[1]).toEqual('Removing plugin cordova-plugin-camera from fetch.json');
                expect(uninstall.uninstallPlatform.calls.count()).toEqual(1);
                expect(uninstall.uninstallPlugin.calls.count()).toEqual(1);
                // Prepare for platform should be called.
                expect(prepare.preparePlatforms.calls.count()).toEqual(1);
                expect(cordova_util.cdProjectRoot.calls.count()).toEqual(1);
                expect(cordova_util.listPlatforms.calls.count()).toEqual(1);
                expect(cordova_util.projectConfig.calls.count()).toEqual(1);
                expect(cordova_util.requireNoCache.calls.count()).toEqual(1);
                // Should write to package.json
                expect(fs.writeFileSync.calls.count()).toEqual(1);
            }).fail(function(e) {
                expect(e).toBeUndefined();
            }).fin(done);
        });
    });

    describe('unit tests for add', function() {  

        beforeEach(function() {
            plugin.__set__('ConfigParser', cfgMock);
            plugin.__set__('HooksRunner', HooksRunnerMock);
            plugin.__set__('opener', openerMock);
            plugin.__set__('PluginInfoProvider', plugProviderMock);
            spyOn(path, 'basename').and.returnValue('path');
            spyOn(config,'read').and.returnValue(true);
            spyOn(cordova_util, 'cdProjectRoot').and.returnValue('path');
            spyOn(cordova_util, 'findPlugins').and.returnValue('cordova-plugin-camera');
            spyOn(cordova_util, 'fixRelativePath').and.callThrough();
            spyOn(cordova_util, 'listPlatforms').and.returnValue(['ios']);
            spyOn(cordova_util, 'projectConfig').and.returnValue('path');
            spyOn(cordova_util, 'requireNoCache').and.callFake(function() {
                return pkgJson;
            });
            spyOn(events, 'emit').and.returnValue(true);
            spyOn(fs, 'existsSync').and.returnValue(pkgJson);
            spyOn(fs, 'writeFileSync').and.returnValue(true);
            spyOn(path, 'join').and.returnValue('path');
            spyOn(plugman.raw, 'fetch').and.returnValue(Q());
            spyOn(plugman.raw, 'install').and.returnValue(Q([]));
            spyOn(plugin, 'getFetchVersion').and.returnValue(Q(null));
            spyOn(plugin, 'getInstalledPlugins').and.returnValue('list');
            spyOn(plugin, 'parseSource').and.returnValue('cordova-plugin-camera');
            spyOn(plugin, 'saveToConfigXmlOn').and.returnValue(null);
            spyOn(prepare, 'preparePlatforms').and.returnValue(true);
            spyOn(Object, 'keys').and.returnValue([]);
            spyOn(Q, 'reject').and.returnValue(true);
            spyOn(registry, 'info').and.returnValue(Q(true));
            spyOn(superspawn, 'maybeSpawn').and.returnValue(Q({}));
            spyOn(uninstall, 'uninstallPlatform').and.returnValue(Q());
            spyOn(uninstall, 'uninstallPlugin').and.returnValue(Q());
        });

        it('Test 007 : should add and save a plugin when fetching from a Git repository', function(done){
            plugin('add', ['https://github.com/apache/cordova-plugin-splashscreen'], {'save':true})
            .then(function(){
                // Correct calls are made
                expect(registry.info.calls.count()).toEqual(0);
                expect(cordova_util.cdProjectRoot.calls.count()).toEqual(1);
                expect(config.read.calls.count()).toEqual(1);
                expect(cordova_util.findPlugins.calls.count()).toEqual(3);
                expect(cordova_util.listPlatforms.calls.count()).toEqual(1);
                expect(cordova_util.projectConfig.calls.count()).toEqual(2);
                expect(plugman.raw.fetch.calls.count()).toEqual(1);
                expect(plugman.raw.install.calls.count()).toEqual(1);
                expect(events.emit.calls.count()).toEqual(4);
                expect(Q.reject.calls.count()).toEqual(0);
                expect(cordova_util.requireNoCache.calls.count()).toEqual(1);
                expect(fs.writeFileSync.calls.count()).toEqual(1);
                // Correct args
                expect(events.emit.calls.argsFor(0)[1]).toEqual('Calling plugman.fetch on plugin "https://github.com/apache/cordova-plugin-splashscreen"');
            }).fail(function(e) {
                expect(e).toBeUndefined();
            }).fin(done);
        });

        it('Test 008 : should add and save a plugin successfully with variables', function(done){
            plugin('add', ['cordova-plugin-camera'],{'save': true}, {'cli_variables': {'someKey':'someValue'}})
            .then(function(){
                // Correct calls are made
                expect(cordova_util.cdProjectRoot.calls.count()).toEqual(1);
                expect(config.read.calls.count()).toEqual(1);
                expect(cordova_util.findPlugins.calls.count()).toEqual(3);
                expect(cordova_util.listPlatforms.calls.count()).toEqual(1);
                expect(cordova_util.projectConfig.calls.count()).toEqual(2);
                expect(plugman.raw.fetch.calls.count()).toEqual(1);
                expect(plugman.raw.install.calls.count()).toEqual(1);
                expect(events.emit.calls.count()).toEqual(8);
                expect(Q.reject.calls.count()).toEqual(0);
                expect(cordova_util.requireNoCache.calls.count()).toEqual(2);
                expect(fs.writeFileSync.calls.count()).toEqual(1);
            }).fail(function(e) {
                expect(e).toBeUndefined();
            }).fin(done);
        });

        it('Test 012 : add a plugin and save to pkgJson and config.xml', function(done) {
            plugin('add', ['cordova-plugin-camera'], {'save':true})
            .then(function(){
                // Correct calls are made
                expect(cordova_util.cdProjectRoot.calls.count()).toEqual(1);
                expect(config.read.calls.count()).toEqual(1);
                expect(cordova_util.findPlugins.calls.count()).toEqual(3);
                expect(cordova_util.listPlatforms.calls.count()).toEqual(1);
                expect(cordova_util.projectConfig.calls.count()).toEqual(2);
                expect(plugman.raw.fetch.calls.count()).toEqual(1);
                expect(plugman.raw.install.calls.count()).toEqual(1);
                expect(events.emit.calls.count()).toEqual(8);
                expect(Q.reject.calls.count()).toEqual(0);
                expect(cordova_util.requireNoCache.calls.count()).toEqual(2);
                expect(fs.writeFileSync.calls.count()).toEqual(1);
                // Correct args
                expect(events.emit.calls.argsFor(0)[1]).toEqual('No version specified for cordova-plugin-camera, retrieving version from config.xml');
                expect(events.emit.calls.argsFor(1)[1]).toEqual('No version for cordova-plugin-camera saved in config.xml');
                expect(events.emit.calls.argsFor(2)[1]).toEqual('Attempting to use npm info for cordova-plugin-camera to choose a compatible release');
                expect(events.emit.calls.argsFor(3)[1]).toEqual('npm info for undefined did not contain any engine info. Fetching latest release');
                expect(events.emit.calls.argsFor(4)[1]).toContain('Calling plugman.fetch on plugin');
                expect(events.emit.calls.argsFor(5)[1]).toContain('Calling plugman.install on plugin');
                expect(events.emit.calls.argsFor(6)[1]).toContain('config.xml');
                expect(events.emit.calls.argsFor(7)[1]).toContain('package.json');
            }).fail(function(e) {
                expect(e).toBeUndefined();
            }).fin(done);
        });

        it('Test 011 : add and save a plugin with specified version', function(done) {
            plugin('add', ['cordova-plugin-camera@^2.4.0'], {'save':true})
            .then(function(){
                // Correct calls are made
                expect(cordova_util.cdProjectRoot.calls.count()).toEqual(1);
                expect(config.read.calls.count()).toEqual(1);
                expect(cordova_util.findPlugins.calls.count()).toEqual(3);
                expect(cordova_util.listPlatforms.calls.count()).toEqual(1);
                expect(cordova_util.projectConfig.calls.count()).toEqual(2);
                expect(plugman.raw.fetch.calls.count()).toEqual(1);
                expect(plugman.raw.install.calls.count()).toEqual(1);
                expect(events.emit.calls.count()).toEqual(4);
                expect(Q.reject.calls.count()).toEqual(0);
                expect(cordova_util.requireNoCache.calls.count()).toEqual(1);
                expect(fs.writeFileSync.calls.count()).toEqual(1);
                // Correct args
                expect(events.emit.calls.argsFor(0)[1]).toEqual('Calling plugman.fetch on plugin "cordova-plugin-camera@^2.4.0"');
            }).fail(function(e) {
                expect(e).toBeUndefined();
            }).fin(done);
        });
    });
});
