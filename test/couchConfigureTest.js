/*global describe*/
/*global it*/
/*global afterEach*/
/*global beforeEach*/
/* exported should */ // suppresses weird warning about should never being used when it very much is

"use strict";

var chai = require("chai"),
    expect = chai.expect,
    should = chai.should(),
    Couch = require("../lib/couchConfigure.js"),
    couchdb = new Couch(),
    nock = require("nock");

describe("The nano library ", function () {
    beforeEach(function () {
    });
    afterEach(function () {
    });

    it("methods should return rejected promises if it is not initialized ", function (done) {
        couchdb.get("12345").then(function (body) {
            // array 0 is body
            done(body);
        }, function (reason) {
            reason.should.be.a.string();
            done();
        });
    });
    it("merge should overwrite data", function (done) {
        // Here we are mocking a couch authentication
        nock("http://test/")
        .post("/_session")
        .reply(200, {
            ok: true,
            name: "tester",
            roles: ["nock", "is", "cool"]
        }, {
            // Third argument is the response header
            "set-cookie": "Yummo"
        });
        couchdb.initialize("http://test", "tester", "pass", "test").then(function (response) {
            nock("http://test/")
            .get("/test/9")
            .reply(200, {
                _id: "9", testKey1: "originalVal", testKey2: "originalVal"
            });
            nock("http://test/")
            // We can use Nock to match the expected JSON body.
            .post("/test", {
                _id: "9", testKey1: "updatedVal", testKey2: "originalVal", testKey3: "newVal"
            })
            .reply(200, {
                ok: true
            });

            return couchdb.merge({
                _id: "9", testKey1: "updatedVal", testKey3: "newVal"
            });
        }).then(function (body) {
            body.ok.should.equal(true);
            done();
        }).catch(function (reason) {
            done(reason);
            console.log(reason + "\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        });
    });
    it("replace should get the right rev", function (done) {
        // Here we are mocking a couch authentication
        nock("http://test/")
        .post("/_session")
        .reply(200, {
            ok: true,
            name: "tester",
            roles: ["nock", "is", "cool"]
        }, {
            // Third argument is the response header
            "set-cookie": "Yummo"
        });
        couchdb.initialize("http://test", "tester", "pass").then(function (response) {
            couchdb.use("test");
            console.log("Login Response " + JSON.stringify(response));
            nock("http://test/")
            .head("/test/9")
            .reply(200, {}, {
                etag: "99-ce54ca73ee9cfaec22610765aa6f04d5"
            });
            nock("http://test/")
            .post("/test", {
                _id: "9", testKey1: "updatedVal", testKey3: "newVal", _rev: "99-ce54ca73ee9cfaec22610765aa6f04d5"
            })
            .reply(200, {
                ok: true
            });

            return couchdb.replace({
                _id: "9", testKey1: "updatedVal", testKey3: "newVal"
            });
        }).then(function (body) {
            body.ok.should.equal(true);
            done();
        }).catch(function (reason) {
            done(reason);
            console.log(reason + "\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        });
    });
});
