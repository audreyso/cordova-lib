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
var helpers = require('./helpers'),
    path = require('path'),
    fs = require('fs'),
    shell = require('shelljs'),
    events = require('cordova-common').events,
    cordova = require('../src/cordova/cordova'),
    rewire = require('rewire'),
    prepare = require('../src/cordova/prepare'),
    platforms = require('../src/platforms/platforms'),
    platform = rewire('../src/cordova/platform.js');

var projectRoot = 'C:\\Projects\\cordova-projects\\move-tracker';
var pluginsDir = path.join(__dirname, 'fixtures', 'plugins');

// Testing will check if "cordova prepare" is restoring platforms as expected.
describe('platform end-to-end with --save', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, 'fixtures', 'basePkgJson2'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson2'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
        var cwd = process.cwd();
        delete require.cache[require.resolve(path.join(process.cwd(),'package.json'))];
        process.chdir(path.join(__dirname, '..'));  // Needed to rm the dir on Windows.
        shell.rm('-rf', tmpDir);
    });

    // Factoring out some repeated checks.
    function emptyPlatformList() {
        return cordova.raw.platform('list').then(function() {
            var installed = results.match(/Installed platforms:\n  (.*)/);
            expect(installed).toBeDefined();
            expect(installed[1].indexOf(helpers.testPlatform)).toBe(-1);
        });
    }

    function fullPlatformList() {
        return cordova.raw.platform('list').then(function() {
            var installed = results.match(/Installed platforms:\n  (.*)/);
            expect(installed).toBeDefined();
            expect(installed[1].indexOf(helpers.testPlatform)).toBeGreaterThan(-1);
        });
    }

    it('Test#001 : should restore platform that has been removed from project', function(done) {
        var cwd = process.cwd();
        var pkgJsonPath = path.join(cwd,'package.json');
        var pkgJson = require(pkgJsonPath);
        var platformsFolderPath;

        emptyPlatformList().then(function() {
            // Remove android from package.json to clear the platform list
            return cordova.raw.platform('rm', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Add the testing platform with --save.
            return cordova.raw.platform('add', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Require platformsFolderPath
            platformsFolderPath = (path.join(cwd,'platforms/platforms.json'));
            var platformsJson = require(platformsFolderPath);
            // Check the platform add was successful in package.json.
            expect(pkgJson.cordova.platforms).not.toBeUndefined();
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toBeGreaterThan(-1);
            // Expect that "helpers.testPlatform" in the installed platform list in platforms.json
            expect(platformsJson).toBeDefined();
            expect(platformsJson[helpers.testPlatform]).toBeDefined();
        }).then(fullPlatformList) // Platform should still be in platform ls.
          .then(function() {
            // And now remove helpers.testPlatform without --save.
            return cordova.raw.platform('rm', [helpers.testPlatform]);
        }).then(function() {
            // Delete any previous caches of require(package.json) and (platforms.json)
            delete require.cache[require.resolve(platformsFolderPath)];
            platformsJson = require(platformsFolderPath);
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Check that the platform removed without --save is still in platforms key.
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toBeGreaterThan(-1);
            // Check that the platform was removed from the platforms.json
            expect(platformsJson[helpers.testPlatform]).toBeUndefined();
        }).then(function() {
            // Run cordova prepare
            return cordova.raw.prepare();
        }).then(function() {
            // Delete any previous caches of platforms.json
            delete require.cache[require.resolve(platformsFolderPath)];
            platformsJson = require(platformsFolderPath);
            // Expect "helpers.testPlatform" to be in the installed platforms list in platforms.json.
            expect(platformsJson[helpers.testPlatform]).toBeDefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },30000);

    it('Test#002 : should NOT restore platform that was removed with --save', function(done) {
        var cwd = process.cwd();
        var pkgJsonPath = path.join(cwd,'package.json');
        var pkgJson;
        var platformsFolderPath;
        var secondPlatformAdded = 'ios';

        emptyPlatformList().then(function() {
            // Remove android from package.json to clear the platform list
            return cordova.raw.platform('rm', [helpers.testPlatform], {'save': true});
        }).then(function() {
            // Add the testing platform with --save.
            return cordova.raw.platform('add', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Add the 'ios' platform with --save
            return cordova.raw.platform('add',secondPlatformAdded, {'save':true});
        }).then(function() {
            // Delete any previous caches of require(package.json) and (platforms.json)
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            platformsFolderPath = (path.join(cwd,'platforms/platforms.json'));
            var platformsJson = require(platformsFolderPath);
            delete require.cache[require.resolve(platformsFolderPath)];
            platformsJson = require(platformsFolderPath);
            // Check the platform add of both platforms was successful.
            expect(pkgJson.cordova.platforms).not.toBeUndefined();
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toEqual(0);
            expect(pkgJson.cordova.platforms.indexOf(secondPlatformAdded)).toEqual(1);
            // Expect that "helpers.testPlatform" in the installed platform list in platforms.json
            expect(platformsJson).toBeDefined();
            expect(platformsJson[helpers.testPlatform]).toBeDefined();
            expect(platformsJson[secondPlatformAdded]).toBeDefined();
        }).then(fullPlatformList) // Platform should still be in platform ls.
          .then(function() {
            // Remove helpers.testPlatform with --save.
            return cordova.raw.platform('rm', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Remove secondPlatformAdded without --save
            return cordova.raw.platform('rm', secondPlatformAdded);
        }).then(function() {
            // Delete any previous caches of require(package.json) and (platformsJson)
            delete require.cache[require.resolve(platformsFolderPath)];
            platformsJson = require(platformsFolderPath);
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Check that the platform removed without --save is still in platforms key.
            expect(pkgJson.cordova.platforms.indexOf(secondPlatformAdded)).toEqual(0);
            // Check that the helpers.testPlatform (removed with --save) was removed from the platforms.json
            expect(platformsJson[helpers.testPlatform]).toBeUndefined();
        }).then(function() {
            // Run cordova prepare
            return cordova.raw.prepare();
        }).then(function() {
            // Delete any previous caches of platformsJson
            delete require.cache[require.resolve(platformsFolderPath)];
            platformsJson = require(platformsFolderPath);
            // Expect "helpers.testPlatform" to be in the installed platforms list in platforms.json
            expect(platformsJson[helpers.testPlatform]).toBeUndefined();
            // Expect 'ios' not to be in platforms.json and has not been restored.
            expect(platformsJson[secondPlatformAdded]).toBeDefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },30000);

    it('Test#003 : should NOT restore platform that was not saved and removed', function(done) {
        var cwd = process.cwd();
        var pkgJsonPath = path.join(cwd,'package.json');
        var pkgJson = require(pkgJsonPath);
        var platformsFolderPath;
        var secondPlatformAdded = 'ios';

        emptyPlatformList().then(function() {
            // Remove android from package.json to clear the platform list
            return cordova.raw.platform('rm', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Add 'ios' platform to project without --save
            return cordova.raw.platform('add', secondPlatformAdded);
        }).then(function() {
            // Add helpers.testPlatform to project with --save
            return cordova.raw.platform('add', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Delete any previous caches of require(package.json) and (platformsJson)
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            platformsFolderPath = (path.join(cwd,'platforms/platforms.json'));
            var platformsJson = require(platformsFolderPath);
            delete require.cache[require.resolve(platformsFolderPath)];
            platformsJson = require(platformsFolderPath);
            // Check the platform add of both platforms was successful in package.json.
            expect(pkgJson.cordova.platforms).not.toBeUndefined();
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toBeGreaterThan(-1);
            // Expect both platforms to be installed platform list in platforms.json
            expect(platformsJson[helpers.testPlatform]).toBeDefined();
            expect(platformsJson[secondPlatformAdded]).toBeDefined();
        }).then(fullPlatformList) // Platforms should still be in platform ls.
          .then(function() {
            // Remove helpers.testPlatform without --save.
            return cordova.raw.platform('rm', [helpers.testPlatform]);
        }).then(function() {
            // Remove secondPlatformAdded without --save.
            return cordova.raw.platform('rm', secondPlatformAdded);
        }).then(function() {
            // Delete any previous caches of require(pkgJson) and (platformsJson)
            delete require.cache[require.resolve(platformsFolderPath)];
            platformsJson = require(platformsFolderPath);
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Check that the platform that was added with --save is still in package.json.
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toBeGreaterThan(-1);
            // Check that both platforms were removed from the platforms.json.
            expect(platformsJson[secondPlatformAdded]).toBeUndefined();
            expect(platformsJson[helpers.testPlatform]).toBeUndefined();
        }).then(function() {
            // Run cordova prepare
            return cordova.raw.prepare();
        }).then(function() {
            // Delete any previous caches of platformsJson
            delete require.cache[require.resolve(platformsFolderPath)];
            platformsJson = require(platformsFolderPath);
            // Expect "helpers.testPlatform" to be in the installed platforms list
            expect(platformsJson[helpers.testPlatform]).toBeDefined();
            // Expect that 'ios' will not be in platforms.json and has not been restored.
            expect(platformsJson[secondPlatformAdded]).toBeUndefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },30000);
});




