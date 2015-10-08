import nano from "nano";

let logger = require("winston"),
    _ = require("lodash");

export default class couchConfigure {
    constructor () {
        logger.level = "warn";
    }
    setLogLevel (level) {
        logger.level = level;
    }
    getLogLevel (level) {
        return logger.level;
    }
    initialize (couchURL, database, user, pass) {
        logger.info("Initialized called!");
        let self = this;
        return new Promise (
            function (resolve, reject) {
                nano(couchURL).auth(user, pass, function (err, body, headers) {
                    if (err) {
                        logger.error("Auth Error "  + err);
                        reject(err);
                    }
                    if (headers && headers["set-cookie"]) {
                        self.auth = headers["set-cookie"];
                        self.db = nano({
                            url : couchURL + "/" + database, cookie: self.auth
                        });
                    }
                    resolve("it worked " + JSON.stringify(body));
                });
            }
        );
    }

    get (key) {
        let self = this;
        return new Promise (function (resolve, reject) {
            if (!self.db) {
                reject("No database configured.  Please Run initialize " + self.db);
            }
            logger.info("DB Get called with " + key);
            self.db.get(key, function (err, body) {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.info("Got a body " + JSON.stringify(body));
                    resolve(body);
                }
            });
        });
    }

    fetch (keys) {
        let self = this;
        return new Promise (function (resolve, reject) {
            if (!self.db) {
                reject("No database configured.  Please Run initialize " + self.db);
            }
            logger.info("DB Fetch called with " + JSON.stringify(keys));
            self.db.fetch({
                keys: keys
            }, function (err, body) {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.silly("Fetch return body " + JSON.stringify(body));
                    resolve(body);
                }
            });
        });
    }
    head (key) {
        let self = this;
        return new Promise (function (resolve, reject) {
            if (!self.db) {
                reject("No database configured.  Please Run initialize " + self.db);
            }
            self.db.head(key, function (err, _, headers) {
                if (err) {
                    reject(err);
                }
                if (headers) {
                    logger.silly("Got Headers: " + JSON.stringify(headers));
                    resolve(headers);
                }
            });
        });
    }
    insert (doc, key) {
        let self = this;
        return new Promise (function (resolve, reject) {
            if (!self.db) {
                reject("No database configured.  Please Run initialize " + self.db);
            }
            self.db.insert(doc, key, function (err, body) {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.silly("Got Body" + JSON.stringify(body));
                    resolve(body);
                }
            });
        });
    }
    update (doc) {
        let self = this;
        return new Promise (function (resolve, reject) {
            if (!self.db) {
                reject("No database configured.  Please Run initialize " + self.db);
            }
            logger.info("Sending PUT request" + JSON.stringify(doc));
            self.db.insert(doc, function (err, body) {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.info("Got Body" + JSON.stringify(body));
                    resolve(body);
                }
            });
        });
    }
    merge (newDoc) {
        let self = this,
            doc = {};
        return new Promise (function (resolve, reject) {
            if (!self.db) {
                reject("No database configured.  Please Run initialize " + self.db);
            }
            if (!(newDoc && newDoc._id)) {
                reject("Merge: Document and Key cannot be undefined");
            }
            self.db.get(newDoc._id, function (err, body) {
                if (err) {
                    reject("merge error: " + err);
                }
                logger.info("Go existing data " + JSON.stringify(body));
                doc = _.assign(body, newDoc);
                logger.info("Merged doc: " + JSON.stringify(doc));
                self.db.insert(doc, function (err, body) {
                    if (err) {
                        reject(err);
                    }
                    if (body) {
                        logger.info("Got Body" + JSON.stringify(body));
                        resolve(body);
                    }
                });
            });
        });
    }
    delete (key) {
        let self = this,
            doc = {};
        return new Promise (function (resolve, reject) {
            if (!self.db) {
                reject("No database configured.  Please Run initialize " + self.db);
            }
            if (!key) {
                reject("Delete: Key cannot be undefined");
            }
            logger.info("Doc Key " + key);
            self.db.get(key, function (err, body) {
                if (err) {
                    reject("Delete error: " + err);
                }
                logger.info("Found Doc " + JSON.stringify(body));
                doc = _.assign(body, {
                    _deleted: true
                });
                logger.info("Deleted doc: " + JSON.stringify(doc));
                self.db.insert(doc, function (err, body) {
                    if (err) {
                        reject(err);
                    }
                    if (body) {
                        logger.info("Got Body" + JSON.stringify(body));
                        resolve(body);
                    }
                });
            });
        });
    }
    replace (doc) {
        let self = this,
            key;
        return new Promise (function (resolve, reject) {
            if (!self.db) {
                reject("No database configured.  Please Run initialize " + self.db);
            }
            if (!(doc && doc._id)) {
                reject("Delete: Document and Key cannot be undefined");
            }
            key = doc._id;
            logger.info("Doc Key " + key);
            self.head(key).then(function (body) {
                logger.info("Head Response: " + JSON.stringify(body));
                doc._rev = body.etag.replace(/"/g, "");
                return self.update(doc);
            }, function (reason) {
                logger.info("Error Heading: " + reason);
                return self.update(doc);
            }).then(function (body) {
                logger.info("Replace: " + JSON.stringify(body));
                resolve(body);
            }).catch (function (reason) {
                logger.error("Replace error: " + reason);
                reject(reason);
            });
        });
    }
    // Here we pass in an array of documents, it should work for create and update
    bulk (docs) {
        let self = this;
        return new Promise (function (resolve, reject) {
            if (!self.db) {
                reject("No database configured.  Please Run initialize " + self.db);
            }
            logger.silly("self.db.bulk sending: \n" + JSON.stringify(docs));
            self.db.bulk({
                docs: docs
            }, function (err, body) {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.silly("Got bulk body response" + JSON.stringify(body));
                    resolve(body);
                }
            });
        });
    }
    setSecurity (securityDoc) {
        let self = this;
        return new Promise (function (resolve, reject) {
            if (!self.db) {
                reject("No database configured.  Please Run initialize " + self.db);
            }
            self.db.insert(securityDoc, "_security").then(function (body) {
                logger.info(JSON.stringify(body));
            }).catch(function (reason) {
                logger.info(reason);
            });
        });
    }
    // Pass in design doc name, view name and an array of keys
    view (designName, viewName, keys) {
        let self = this;
        return new Promise (function (resolve, reject) {
            if (!self.db) {
                reject("No database configured.  Please Run initialize " + self.db);
            }
            self.db.view(designName, viewName, {
                keys: keys
            }, function (err, body) {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.silly("View Body" + JSON.stringify(body) + "\n db" + JSON.stringify(self.db));
                    let ids = [];
                    body.rows.forEach(function (viewRow) {
                        ids.push(viewRow.id);
                    });
                    resolve(ids);
                }
            });
        });
    }
}
