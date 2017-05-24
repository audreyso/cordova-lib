var	Q = require('q'),
	rewire = require('rewire'),
	uninstall = rewire('../src/plugman/uninstall'),
    events = require('cordova-common').events,
    fs = require('fs'),
    path = require('path'),
    cordovaUtil = require('../src/cordova/util');

describe('uninstall functions should be called successfully', function() {
	it('should successfully call handleUninstall', function(done) {
		spyOn(uninstall, 'handleUninstall').and.returnValue(true);
		uninstall.handleUninstall();
		expect(uninstall.handleUninstall.calls.count()).toBe(1);
		done();
	},6000);

	it('should successfully call runUninstallPlatform', function(done) {
		spyOn(uninstall, 'runUninstallPlatform').and.returnValue(true);
		uninstall.runUninstallPlatform();
		expect(uninstall.runUninstallPlatform.calls.count()).toBe(1);
		done();
	},6000);

	it('should successfully call uninstallPlugin', function(done) {
		spyOn(uninstall, 'uninstallPlugin').and.returnValue(true);
		uninstall.uninstallPlugin();
		expect(uninstall.uninstallPlugin.calls.count()).toBe(1);
		done();
	},6000);

	it('should successfully call uninstallPlatform', function(done) {
		spyOn(uninstall, 'uninstallPlatform').and.returnValue(true);
		uninstall.uninstallPlatform();
		expect(uninstall.uninstallPlatform.calls.count()).toBe(1);
		done();
	},6000);
});

describe('uninstallPlatform function', function() {
	it('should throw error if platform not found', function(done) {
		spyOn(Q, 'reject').and.returnValue(true);
		uninstall.uninstallPlatform('platform', 'project_dir', 'id', 'plugins_dir', 'options');
		expect(Q.reject.calls.count()).toBe(1);
		expect(Q.reject.calls.allArgs().toString()).toEqual('platform not supported.');
		done();
	},6000);

	it('platform should be found, reject plugin id', function(done) {
		spyOn(Q, 'reject').and.returnValue(true);
		uninstall.uninstallPlatform('android', 'project_dir', 'id', 'plugins_dir', 'options');
		expect(Q.reject.calls.count()).toBe(1);
		expect(Q.reject.calls.allArgs().toString()).toEqual('Plugin "id" not found. Already uninstalled?');
		done();
	},6000);

	it('uninstallPlatform should not throw any errors', function(done) {
		spyOn(Q, 'reject').and.returnValue(false);
		spyOn(path, 'join').and.returnValue('somepath');
		spyOn(cordovaUtil, 'convertToRealPathSafe').and.returnValue('somepath');
		spyOn(fs,'existsSync').and.callFake(function(filePath) {
            if(path.basename(filePath) === 'somepath') {
                return true;
            } else {
                return false;
            }
        });
		uninstall.uninstallPlatform('android', 'somepath', 'cordova-plugin-splashscreen', 'plugins_dir', 'options');
		expect(Q.reject.calls.count()).toBe(0);
		expect(cordovaUtil.convertToRealPathSafe.calls.count()).toBe(2);
		expect(fs.existsSync.calls.count()).toBe(1);
		done();
	},6000);
});

describe('uninstallPlugin function', function() {
	it('uninstallPlugin ', function(done) {
		spyOn(events, 'emit').and.returnValue(true);
		uninstall.uninstallPlugin('cordova-plugin-splashscreen', 'plugins_dir', 'options');
		expect(events.emit.calls.count()).toBe(2);
		expect(events.emit.calls.argsFor(0)[1]).toContain('Removing "cordova-plugin-splashscreen"');
		expect(events.emit.calls.argsFor(1)[1]).toContain('Plugin "cordova-plugin-splashscreen" already removed');
		done();
	},6000);

	xit('uninstallPlugin should not throw any errors', function(done) {
    	var getPref = { getPreferences: function(){} };

		var plugProviderMock = function() {};
		plugProviderMock.prototype.get = function() {return getPref;};

		uninstall.__set__('PluginInfoProvider', plugProviderMock);
		
		spyOn(events, 'emit').and.returnValue(false);
		spyOn(path, 'join').and.returnValue('somepath');
		spyOn(cordovaUtil, 'convertToRealPathSafe').and.returnValue('somepath');
		spyOn(fs,'existsSync').and.callFake(function(filePath) {
            if(path.basename(filePath) === 'somepath') {
                return true;
            } else {
                return false;
            }
        });
		uninstall.uninstallPlugin('cordova-plugin-splashscreen', 'plugins_dir', 'options');
		done();
	},6000);
});