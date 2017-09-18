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

var Q = require('q');
var shell = require('shelljs');
var events = require('cordova-common').events;
var rewire = require('rewire');
var cordova_util = require('../../../src/cordova/util');
var platform_check = rewire('../../../src/cordova/platform/check');

describe('cordova/platform/addHelper', function () {
    var projectRoot = '/some/path';
    var hooks_mock;

    beforeEach(function () {
        hooks_mock = jasmine.createSpyObj('hooksRunner mock', ['fire']);
        hooks_mock.fire.and.returnValue(Q());
        spyOn(events, 'emit');
        spyOn(shell, 'rm');
    });

    describe('happy path', function () {
        it('should not update platforms', function (done) {
            platform_check(hooks_mock, projectRoot).then(function () {
                expect(shell.rm).toHaveBeenCalledWith('-rf', jasmine.stringMatching('cordova-platform-check'));
                expect(events.emit).toHaveBeenCalledWith('results', 'No platforms can be updated at this time.');
            }).fail(function (err) {
                fail('unexpected failure handler invoked!');
                console.error(err);
            }).done(done);
        }, 6000);

        it('platform cannot install & version not determined', function (done) {
            spyOn(cordova_util, 'listPlatforms').and.returnValue(['platform']);
            platform_check(hooks_mock, projectRoot).then(function (result) {
                expect(events.emit).toHaveBeenCalledWith('results', 'platform @ unknown; current did not install, and thus its version cannot be determined');
            }).fail(function (err) {
                fail('unexpected failure handler invoked!');
                console.error(err);
            }).done(done);
        }, 600000);

        xit('platform could be updated to', function (done) {
            spyOn(cordova_util, 'listPlatforms').and.returnValue(['ios@4.0.0']);
            platform_check(hooks_mock, projectRoot).then(function (result) {
                expect(events.emit).toHaveBeenCalledWith('results', jasmine.stringMatching('could be updated to:'));
            }).fail(function (err) {
                fail('unexpected failure handler invoked!');
                console.error(err);
            }).done(done);
        }, 600000);
    });
});
