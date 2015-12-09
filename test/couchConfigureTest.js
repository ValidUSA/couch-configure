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
    beforeEach(function () {});
    afterEach(function () {});

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
                    _id: "9",
                    testKey1: "originalVal",
                    testKey2: "originalVal"
                });
            nock("http://test/")
                // We can use Nock to match the expected JSON body.
                .post("/test", {
                    _id: "9",
                    testKey1: "updatedVal",
                    testKey2: "originalVal",
                    testKey3: "newVal"
                })
                .reply(200, {
                    ok: true
                });

            return couchdb.merge({
                _id: "9",
                testKey1: "updatedVal",
                testKey3: "newVal"
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
            })
            .post("/test", {
                _id: "9",
                testKey1: "updatedVal",
                testKey3: "newVal",
                _rev: "99-ce54ca73ee9cfaec22610765aa6f04d5"
            })
            .reply(200, {
                ok: true
            });
        couchdb.initialize("http://test", "tester", "pass").then(function (response) {
            couchdb.use("test");
            console.log("Login Response " + JSON.stringify(response));
            nock("http://test/")
                .head("/test/9")
                .reply(200, {}, {
                    etag: "99-ce54ca73ee9cfaec22610765aa6f04d5"
                });

            return couchdb.replace({
                _id: "9",
                testKey1: "updatedVal",
                testKey3: "newVal"
            });
        }).then(function (body) {
            body.ok.should.equal(true);
            done();
        }).catch(function (reason) {
            done(JSON.stringify(reason));
            console.log(JSON.stringify(reason) + "\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        });
    });
    it("addAdmin should create an admin user without authenticating ", function (done) {
        nock("http://test/")
            .put("/_config/admins/testadmin")
            .reply(200, {
                ok: true
            });
        couchdb.addAdmin("http://test", "testadmin", "testPass").then(function (body) {
            body.ok.should.equal(true);
            // array 0 is body
            done();
        }).catch(function (reason) {
            done(reason);
            console.log("Error in addAdmin test " + reason);
        });
    });

    it("addAdmin should create an admin user without authenticating ", function (done) {
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

        nock("http://test/", {
            reqheaders: {
                Cookie: "Yummo"
            }
        })
            .put("/_config/admins/testadmin")
            .reply(200, {
                ok: true
            });
        couchdb.initialize("http://test", "tester", "pass", "test").then(function (response) {
            return couchdb.addAdmin("http://test", "testadmin", "testPass");
        }).then(function (body) {
            body.ok.should.equal(true);
            // array 0 is body
            done();
        }).catch(function (reason) {
            done(reason);
            console.log("Error in addAdmin test " + reason);
        });
    });
    it("We should update the cookie when it changes", function (done) {
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
            })
            .post("/test")
            .reply(200, {
                ok: true
            }, {
                "set-cookie": "Yammo"
            });
        couchdb.initialize("http://test", "tester", "pass").then(function (response) {
            couchdb.use("test");
            console.log("Login Response " + JSON.stringify(response));
            nock("http://test/")
                .head("/test/9")
                .reply(200, {}, {
                    etag: "99-ce54ca73ee9cfaec22610765aa6f04d5"
                });

            return couchdb.update({
                _id: "9",
                testKey1: "updatedVal",
                testKey3: "newVal"
            });
        }).then(function (body) {
            nock("http://test/")
                .matchHeader("cookie", (val) => {
                    console.log("!!!!Cookie Value " + val);
                    return (val.search("Yammo") !== -1);
                })
                .post("/test")
                .reply(200, {
                    ok: true
                });
            return couchdb.update({
                _id: "9",
                testKey1: "updatedVal",
                testKey3: "newVal"
            });
        }).then(function (body) {
            body.ok.should.equal(true);
            done();
        }).catch(function (reason) {
            done(JSON.stringify(reason));
            console.log(JSON.stringify(reason) + "\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        });
    });
    it("We should reauthenticate when we get a 401", function (done) {
        let scope2;
        let scope3;
        // Here we are mocking a couch authentication
        let scope = nock("http://test/")
            .post("/_session")
            .reply(200, {
                ok: true,
                name: "tester",
                roles: ["nock", "is", "cool"]
            }, {
                // Third argument is the response header
                "set-cookie": "Yummo"
            })
            .post("/test")
            .reply(401, {
                error: "unauthorized",
                reason: "You are not authorized to access this db."
            }, {
                "HTTP/1.1 401 Unauthorized": "",
                Server: "CouchDB/1.6.1 (Erlang OTP/R16B02)",
                Date: "Wed, 09 Dec 2015 15:21:38 GMT",
                "Content-Type": "application/json",
                "Content-Length": 78,
                "Cache-Control": "must-revalidate"
            });

        couchdb.initialize("http://test", "tester", "pass", "test")
            .then(function (response) {
                couchdb.use("test");
                console.log("Login Response " + JSON.stringify(response));

                // Second Authorization
                scope2 = nock("http://test/")
                    .post("/_session")
                    .reply(200, {
                        ok: true,
                        name: "tester",
                        roles: ["nock", "is", "cool"]
                    }, {
                        // Third argument is the response header
                        "set-cookie": "ReAuthCookie"
                    });

                // Second request should use reauth cookie
                scope3 = nock("http://test/")
                    .matchHeader("cookie", (val) => {
                        console.log("!!!!Cookie Value " + val);
                        if (val) {
                            return (val.search("ReAuthCookie") !== -1);
                        } else {
                            return false;
                        }
                    })
                    .post("/test")
                    .reply(200, {
                        ok: true
                    });

                return couchdb.update({
                    _id: "9",
                    testKey1: "updatedVal",
                    testKey3: "newVal"
                });
            }).then(function (body) {
            body.ok.should.equal(true);
            scope.done();
            scope2.done();
            scope3.done();
            done();
        }).catch(function (reason) {
            done(JSON.stringify(reason));
            console.log(JSON.stringify(reason) + "\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        });
    });
});
