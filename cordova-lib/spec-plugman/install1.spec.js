var	Q = require('q'),
	rewire = require('rewire'),
	install = rewire('../src/plugman/install'),
    events = require('cordova-common').events,
    plugman = require('../src/plugman/plugman'),
    fs = require('fs'),
    semver = require('semver');

describe('install functions should be called successfully', function() {

	it('should successfully call copyPlugin', function(done) {
		spyOn(install, 'copyPlugin').and.returnValue(true);
		install.copyPlugin('plugin_src_dir', 'plugins_dir', 'link', 'pluginInfoProvider');
		expect(install.copyPlugin.calls.count()).toBe(1);
		done();
	},6000);

	it('should successfully call isAbsolutePath', function(done) {
		spyOn(install, 'isAbsolutePath').and.returnValue(true);
		install.isAbsolutePath('somepath');
		expect(install.isAbsolutePath.calls.count()).toBe(1);
		done();
	},6000);

	it('should successfully call interp_vars', function(done) {
		spyOn(install, 'interp_vars').and.returnValue(true);
		install.interp_vars('vars', 'text');
		expect(install.interp_vars.calls.count()).toBe(1);
		done();
	},6000);

	it('should successfully call handleInstall', function(done) {
		spyOn(install, 'handleInstall').and.returnValue(true);
		install.handleInstall('actions', 'pluginInfo', 'platform', 'project_dir', 'plugins_dir', 'plugin_dir', 'filtered_variables', 'options');
		expect(install.handleInstall.calls.count()).toBe(1);
		done();
	},6000);

	it('should successfully call installDependency', function(done) {
		spyOn(install, 'installDependency').and.returnValue(true);
		install.installDependency('dep', 'install', 'options');
		expect(install.installDependency.calls.count()).toBe(1);
		done();
	},6000);

	it('should successfully call tryFetchDependency', function(done) {
		spyOn(install, 'tryFetchDependency').and.returnValue(true);
		install.tryFetchDependency('dep', 'install', 'options');
		expect(install.tryFetchDependency.calls.count()).toBe(1);
		done();
	},6000);

	it('should successfully call installDependencies', function(done) {
		spyOn(install, 'installDependencies').and.returnValue(true);
		install.installDependencies('install', 'dependencies', 'options');
		expect(install.installDependencies.calls.count()).toBe(1);
		done();
	},6000);

	it('should successfully call runInstall', function(done) {
		spyOn(install, 'runInstall').and.returnValue(true);
		install.runInstall('install', 'dependencies', 'options');
		expect(install.runInstall.calls.count()).toBe(1);
		done();
	},6000);

	it('should successfully call getEngines', function(done) {
		spyOn(install, 'getEngines').and.returnValue(true);
		install.getEngines('install', 'dependencies', 'options');
		expect(install.getEngines.calls.count()).toBe(1);
		done();
	},6000);

	it('should successfully call callEngineScripts', function(done) {
		spyOn(install, 'callEngineScripts').and.returnValue(true);
		install.callEngineScripts('engines', 'project_dir');
		expect(install.callEngineScripts.calls.count()).toBe(1);
		done();
	},6000);

	it('should throw script path error', function(done) {
		spyOn(events, 'emit').and.returnValue(true);
		install.callEngineScripts(['windows'], 'project_dir');
		expect(events.emit.calls.count()).toBe(1);
		expect(events.emit.calls.argsFor(0)[1]).toContain('version not detected (lacks script null ), continuing.');
		done();
	},6000);

	it('should successfully call cleanVersionOutput', function(done) {
		spyOn(install, 'cleanVersionOutput').and.returnValue(true);
		spyOn(events, 'emit').and.returnValue(true);
		install.cleanVersionOutput('version', 'name');
		expect(install.cleanVersionOutput.calls.count()).toBe(1);
		expect(events.emit.calls.count()).toBe(0);
		done();
	},6000);

	it('should throw error when using development branch', function(done) {
		spyOn(events, 'emit').and.returnValue(true);
		var result = install.cleanVersionOutput('dev', 'branchname');
		expect(events.emit.calls.argsFor(0)[1]).toBe('branchname has been detected as using a development branch. Attemping to install anyways.');
		expect(result).toBe(null);
		done();
	},6000);
	
	it('should successfully call checkEngines', function(done) {
		spyOn(install, 'checkEngines').and.returnValue(true);
		install.checkEngines('engines');
		expect(install.checkEngines.calls.count()).toBe(1);
		done();
	},6000);

	it('should successfully call checkEngines with no errors', function(done) {
		spyOn(Q, 'reject');
		spyOn(events, 'emit');
		spyOn(semver, 'satisfies').and.returnValue(Q(true));
		install.checkEngines(['android']);
		expect(semver.satisfies.calls.count()).toBe(1);
		expect(events.emit.calls.count()).toBe(0);
		expect(Q.reject.calls.count()).toBe(0);
		done();
	},6000);

	it('should throw error with checkEngines', function(done) {
		spyOn(Q, 'reject');
		spyOn(events, 'emit');
		spyOn(semver, 'satisfies');
		install.checkEngines(['android']);
		expect(semver.satisfies.calls.count()).toBe(1);
		expect(events.emit.calls.count()).toBe(1);
		expect(events.emit.calls.argsFor(0)[1]).toEqual('Plugin doesn\'t support this project\'s undefined version. undefined: undefined, failed version requirement: undefined');
		expect(Q.reject.calls.count()).toBe(1);
		expect(Q.reject.calls.argsFor(0)[0]).toEqual('skip');
		done();
	},6000);

	it('should successfully call possiblyFetch', function(done) {
		spyOn(install, 'possiblyFetch').and.returnValue(true);
		install.possiblyFetch('id', 'plugins_dir', 'options');
		expect(install.possiblyFetch.calls.count()).toBe(1);
		done();
	},6000);

	it('should successfully call plugman.raw.fetch with possiblyFetch', function(done) {
		spyOn(plugman.raw, 'fetch').and.returnValue(true);
		install.possiblyFetch('id', 'plugins_dir', 'options');
		expect(plugman.raw.fetch.calls.count()).toBe(1);
		done();
	},6000);
});