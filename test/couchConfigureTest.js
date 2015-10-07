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
        couchdb.initialize("http://test", "test", "tester", "pass").then(function (body) {
            console.log("Login Response " + JSON.stringify(body));
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
});
