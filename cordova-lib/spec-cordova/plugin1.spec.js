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

var path = require('path'),
    Q = require('q'),
    fs = require('fs'),
    semver = require('semver'),
    config = require('../src/cordova/config'),
    events = require('cordova-common').events,
    prepare = require('../src/cordova/prepare'),
    plugman = require('../src/plugman/plugman'),
    uninstall = require('../src/plugman/uninstall'),
    rewire = require('rewire'),
    events = require('cordova-common').events,
    url = require('url'),
    superspawn = require('cordova-common').superspawn,
    metadata = require('../src/plugman/util/metadata'),
    registry = require('../src/plugman/registry/registry');

var cordova_util = require('../src/cordova/util');
var plugin = rewire('../src/cordova/plugin');
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

describe('unit tests for remove', function() {

	var cfgMock = function() {};
	cfgMock.prototype.addPlugin = function() {};
	cfgMock.prototype.getPlugin = function() {};
	cfgMock.prototype.getPluginIdList = function() {return ['list'];};
	cfgMock.prototype.removePlugin = function() {};
	cfgMock.prototype.write = function() {};

	var HooksRunnerMock = function() {};
	HooksRunnerMock.prototype.fire = function() {return Q({});};

	var getPref = { getPreferences: function(){} };

	var plugProviderMock = function() {};
	plugProviderMock.prototype.get = function() {return getPref;};
	plugProviderMock.prototype.getAllWithinSearchPath = function() {return true;};
	plugProviderMock.prototype.getEngines = function() {return;};
	plugProviderMock.prototype.getPreferences = function() {return {};};

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

	it('Test 003 : remove a plugin but do not write to config.xml or pkgJson, if save is true and fetch is true', function(done) {
        spyOn(cordova_util, 'listPlatforms').and.returnValue([]);
        spyOn(fs, 'existsSync').and.returnValue(true);
        plugin('remove', ['cordova-plugin-camera'], {'fetch': true, 'save': false})
		.then(function(){
			// Should only remove from fetch.json.
			expect(events.emit.calls.count()).toEqual(1);
			expect(events.emit.calls.argsFor(0)[1]).toContain('Removing plugin cordova-plugin-camera from fetch.json');
			// No platform added.
			expect(prepare.preparePlatforms.calls.count()).toEqual(0);
			expect(cordova_util.cdProjectRoot.calls.count()).toEqual(1);
			expect(uninstall.uninstallPlugin.calls.count()).toEqual(1);
			expect(cordova_util.listPlatforms.calls.count()).toEqual(1);
			expect(cordova_util.projectConfig.calls.count()).toEqual(0);
			expect(cordova_util.requireNoCache.calls.count()).toEqual(0);
			// Should not write to package.json
			expect(fs.writeFileSync.calls.count()).toEqual(0);
		}).fail(function(e) {
			expect(e).toBeUndefined();
		}).fin(done);
	});

	it('Test 004 : should successfully remove a plugin with no options', function(done) {
		spyOn(cordova_util, 'listPlatforms').and.returnValue([]);
		spyOn(fs, 'existsSync').and.callThrough();
        plugin('remove', ['cordova-plugin-camera'], {})
		.then(function(){
			expect(cordova_util.cdProjectRoot.calls.count()).toEqual(1);
			expect(config.read.calls.count()).toEqual(1);
			expect(cordova_util.findPlugins.calls.count()).toEqual(3);
			expect(cordova_util.listPlatforms.calls.count()).toEqual(1);
			expect(events.emit.calls.count()).toEqual(1);
			expect(events.emit.calls.argsFor(0)[1]).toEqual('Removing plugin cordova-plugin-camera from fetch.json');
			expect(uninstall.uninstallPlatform.calls.count()).toEqual(0);
			expect(uninstall.uninstallPlugin.calls.count()).toEqual(1);
			// No platform added.
			expect(prepare.preparePlatforms.calls.count()).toEqual(0);
			expect(cordova_util.cdProjectRoot.calls.count()).toEqual(1);
			expect(cordova_util.listPlatforms.calls.count()).toEqual(1);
			expect(cordova_util.projectConfig.calls.count()).toEqual(0);
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

	it('Test 006 : prepare is called when no options are passed in & platform exists', function(done) {
        spyOn(cordova_util, 'listPlatforms').and.returnValue(['ios']);
        spyOn(fs, 'existsSync').and.returnValue(true);
        plugin('remove', ['cordova-plugin-camera'])
		.then(function(){
			// Prepare for platform should be called.
			expect(prepare.preparePlatforms.calls.count()).toEqual(1);
		}).fail(function(e) {
			expect(e).toBeUndefined();
		}).fin(done);
	});
});

describe('unit tests for add', function() {

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

    it('Test 007 : should add plugin and not check npm info when fetching from a Git repository', function(done){
    	plugin('add', ['https://github.com/apache/cordova-plugin-splashscreen'])
    	.then(function(){
    		// Correct calls are made
    		expect(registry.info.calls.count()).toEqual(0);
			expect(cordova_util.cdProjectRoot.calls.count()).toEqual(1);
			expect(config.read.calls.count()).toEqual(1);
			expect(cordova_util.findPlugins.calls.count()).toEqual(3);
			expect(cordova_util.listPlatforms.calls.count()).toEqual(1);
			expect(cordova_util.projectConfig.calls.count()).toEqual(1);
			expect(plugman.raw.fetch.calls.count()).toEqual(1);
			expect(plugman.raw.install.calls.count()).toEqual(1);
			expect(events.emit.calls.count()).toEqual(2);
			expect(Q.reject.calls.count()).toEqual(0);
			expect(cordova_util.requireNoCache.calls.count()).toEqual(0);
			expect(fs.writeFileSync.calls.count()).toEqual(0);
			// Correct args
			expect(events.emit.calls.argsFor(0)[1]).toEqual('Calling plugman.fetch on plugin "https://github.com/apache/cordova-plugin-splashscreen"');
    	}).fail(function(e) {
    		expect(e).toBeUndefined();
    	}).fin(done);
    });

    it('Test 008 : should add a plugin successfully with variables', function(done){
        plugin('add', ['cordova-plugin-camera'],{'cli_variables': {'someKey':'someValue'}})
        .then(function(){
        	// Correct calls are made
			expect(cordova_util.cdProjectRoot.calls.count()).toEqual(1);
			expect(config.read.calls.count()).toEqual(1);
			expect(cordova_util.findPlugins.calls.count()).toEqual(3);
			expect(cordova_util.listPlatforms.calls.count()).toEqual(1);
			expect(cordova_util.projectConfig.calls.count()).toEqual(1);
			expect(plugman.raw.fetch.calls.count()).toEqual(1);
			expect(plugman.raw.install.calls.count()).toEqual(1);
			expect(events.emit.calls.count()).toEqual(6);
			expect(Q.reject.calls.count()).toEqual(0);
			expect(cordova_util.requireNoCache.calls.count()).toEqual(1);
			expect(fs.writeFileSync.calls.count()).toEqual(0);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        }).fin(done);
    });
    it('Test 009 : should not check npm info when using the noregistry flag', function(done){
    	plugin('add', ['cordova-plugin-camera'],{'noregistry':true})
    	.then(function(){
    		expect(registry.info.calls.count()).toEqual(0);
    		expect(plugman.raw.fetch.calls.count()).toEqual(1);
    	}).fail(function(e) {
			expect(e).toBeUndefined();
		}).fin(done);
    });

    it('Test 010 : should not check npm info when using the noregistry flag', function(done){
    	plugin('add', ['cordova-plugin-camera'],{'searchpath':'some/path'})
    	.then(function(){
    		expect(registry.info.calls.count()).toEqual(0);
    		expect(plugman.raw.fetch.calls.count()).toEqual(1);
    		var fetchOptions = plugman.raw.fetch.calls.mostRecent().args[2];
            expect(fetchOptions.searchpath[0]).toExist();
    	}).fail(function(e) {
			expect(e).toBeUndefined();
		}).fin(done);
    });

	it('Test 011 : add a plugin with specified version', function(done) {
		plugin('add', ['cordova-plugin-camera@^2.4.0'])
		.then(function(){
			// Correct calls are made
			expect(cordova_util.cdProjectRoot.calls.count()).toEqual(1);
			expect(config.read.calls.count()).toEqual(1);
			expect(cordova_util.findPlugins.calls.count()).toEqual(3);
			expect(cordova_util.listPlatforms.calls.count()).toEqual(1);
			expect(cordova_util.projectConfig.calls.count()).toEqual(1);
			expect(plugman.raw.fetch.calls.count()).toEqual(1);
			expect(plugman.raw.install.calls.count()).toEqual(1);
			expect(events.emit.calls.count()).toEqual(2);
			expect(Q.reject.calls.count()).toEqual(0);
			expect(cordova_util.requireNoCache.calls.count()).toEqual(0);
			expect(fs.writeFileSync.calls.count()).toEqual(0);
			// Correct args
			expect(events.emit.calls.argsFor(0)[1]).toEqual('Calling plugman.fetch on plugin "cordova-plugin-camera@^2.4.0"');
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
			expect(events.emit.calls.argsFor(6)[1]).toContain('package.json');
			expect(events.emit.calls.argsFor(7)[1]).toContain('config.xml');
		}).fail(function(e) {
			expect(e).toBeUndefined();
		}).fin(done);
	});

	it('Test 013 : add a plugin and do not save to pkgJson or config.xml', function(done) {
        plugin('add', ['cordova-plugin-camera'])
		.then(function(){
			// Correct calls are made
			expect(cordova_util.cdProjectRoot.calls.count()).toEqual(1);
			expect(config.read.calls.count()).toEqual(1);
			expect(cordova_util.findPlugins.calls.count()).toEqual(3);
			expect(cordova_util.listPlatforms.calls.count()).toEqual(1);
			expect(events.emit.calls.count()).toEqual(6);
			expect(cordova_util.projectConfig.calls.count()).toEqual(1);
			expect(plugman.raw.fetch.calls.count()).toEqual(1);
			expect(Q.reject.calls.count()).toEqual(0);
			expect(plugman.raw.install.calls.count()).toEqual(1);
			expect(cordova_util.requireNoCache.calls.count()).toEqual(1);
			// Do not write to pkgJson or config.xml.
			expect(events.emit.calls.argsFor(6)[1]).toBeUndefined();
			expect(events.emit.calls.argsFor(7)[1]).toBeUndefined();
			expect(fs.writeFileSync.calls.count()).toEqual(0);
		}).fail(function(e) {
			expect(e).toBeUndefined();
		}).fin(done);
	});

	it('Test 014 : should throw error if no plugin is passed in', function(done){
		plugin('add')
		.then(function(){
			expect(Q.reject.calls.argsFor(0)[0].toString()).toContain('You need to qualify `cordova plugin add` or `cordova plugin remove` with one or more plugins!');
		}).fail(function(e) {
			expect(e).toBeUndefined();
		}).fin(done);
	});

	it('Test 015 : when no plugin specified, should throw error message', function(done) {
        plugin('remove')
		.then(function(){
			expect(Q.reject.calls.argsFor(0)[0].toString()).toContain('No plugin specified. Please specify a plugin to remove. See `cordova plugin list`.');
		}).fail(function(e) {
			expect(e).toBeUndefined();
		}).fin(done);
	});

	it('Test 016 : should search for plugin', function (done) {
		spyOn(Q, 'resolve').and.callThrough();
		plugin('search')
		 .then(function(res){
		 	expect(Q.resolve.calls.count()).toEqual(1);
		}).fail(function(e) {
			expect(e).toBeUndefined();
		}).fin(done);
	});

	it('Test 017 : should use default', function (done) {
		plugin('cordova-plugin-camera')
		 .then(function(res){
		 	expect(events.emit.calls.count()).toEqual(1);
		 	expect(events.emit.calls.argsFor(0)).toEqual([ 'results', '' ]);
		}).fail(function(e) {
			expect(e).toBeUndefined();
		}).fin(done);
	});
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

describe('version unit tests', function() {
	
	it('Test 019 : update and validate version ', function(done) {
		spyOn(semver, 'validRange').and.returnValue(true);
		var result = plugin.versionString('4.0.0');
		expect(result).toEqual('~4.0.0');
		expect(semver.validRange.calls.count()).toEqual(0);
		done();
	});

	it('Test 020 : validate and return version ', function(done) {
		spyOn(semver, 'validRange').and.returnValue(true);
		var result = plugin.versionString('~4.0.0');
		expect(result).toEqual('~4.0.0');
		expect(semver.validRange.calls.count()).toEqual(1);
		expect(semver.validRange.calls.argsFor(0)).toEqual([ '~4.0.0', true ]);
		done();
	});

	it('Test 021 : clean for each version and return null if no change', function(done) {
		spyOn(semver, 'clean').and.callThrough();
		var result = plugin.findVersion([ '2.0.0', '4.0.0' ], '0.0.0');
		expect(result).toEqual(null);
		/// Call 'clean' for each version.
		expect(semver.clean.calls.count()).toEqual(3);
		// Reset semver.clean.
		semver.clean.calls.reset();
		result = plugin.findVersion([ '3.0.0' ], '0.0.0');
		expect(result).toEqual(null);
		/// Call 'clean' for each version.
		expect(semver.clean.calls.count()).toEqual(2);
		done();
	});

	it('Test 022 : return version if they are identical ', function(done) {
		spyOn(semver, 'clean').and.callThrough();
		var result = plugin.findVersion([ '5.0.0' ], '5.0.0');
		expect(result).toEqual('5.0.0');
		expect(semver.clean.calls.count()).toEqual(2);
		done();
	});

	it('Test 023 : parse source properly, if no change return null ', function(done) {
		spyOn(url, 'parse').and.returnValue(true);
		spyOn(cordova_util, 'fixRelativePath').and.returnValue(true);
		spyOn(fs, 'existsSync').and.returnValue(false);
		var result = plugin.parseSource('cordova-plugin-camera', 'opts');
		expect(url.parse.calls.count()).toEqual(1);
		expect(cordova_util.fixRelativePath.calls.count()).toEqual(1);
		expect(fs.existsSync.calls.count()).toEqual(1);
		expect(result).toEqual(null);
		done();
	});

	it('Test 024 : parse source properly, if change, return target plugin ', function(done) {
		spyOn(url, 'parse').and.returnValue(true);
		spyOn(cordova_util, 'fixRelativePath').and.returnValue(true);
		spyOn(fs, 'existsSync').and.returnValue('someDir');
		var result = plugin.parseSource('cordova-plugin-camera', 'opts');
		expect(url.parse.calls.count()).toEqual(1);
		expect(cordova_util.fixRelativePath.calls.count()).toEqual(1);
		expect(fs.existsSync.calls.count()).toEqual(1);
		expect(result).toEqual('cordova-plugin-camera');
		done();
	});

	it('Test 025 : if no variables, just return empt array', function(done) {
		var result = plugin.getPluginVariables();
		expect(result).toEqual([]);
		done();
	});

	it('Test 026 : get plugin variables', function(done) {
		spyOn(Object, 'keys').and.callThrough();
		var result = plugin.getPluginVariables({ variable: '0'});
		expect(Object.keys.calls.count()).toEqual(1);
		expect(result).toEqual([ { name: 'variable', value: '0' } ]);
		done();
	});

	it('Test 027 : warn properly if requirements fail', function(done) {
		spyOn(events, 'emit').and.returnValue(true);
		var result = plugin.listUnmetRequirements('name', ['failed requirements']);
		expect(events.emit.calls.count()).toEqual(2);
		expect(events.emit.calls.argsFor(0)).toEqual(
		[ 'warn','Unmet project requirements for latest version of name:' ]);
		expect(events.emit.calls.argsFor(1)).toContain('warn', '    ' + result + ' (' + result + ' in project, ' + result + ' required)');
		done();
	});
});

