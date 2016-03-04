import nano from "nano";

let logger = require("winston"),
    _ = require("lodash");

export default class couchConfigure {
    constructor() {
        logger.level = "warn";
    }
    setLogLevel(level) {
        logger.level = level;
    }
    getLogLevel(level) {
        return logger.level;
    }
    setHeader(headers) {
        if (headers && headers["set-cookie"]) {
            this.authSession = headers["set-cookie"];
            this.nano = nano({
                url: this.nano.config.url,
                cookie: this.authSession
            });
            this.db = this.nano.use(this.db.config.db);
        }
    }
    callBack(err, body, header, caller, ...callerParams) {
        return new Promise((resolve, reject) => {
            if (err) {
                this.handle401(err)
                    .then((response) => {
                        // Append our callback
                        let cb = (err, body, header) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve([err, body, header]);
                            }
                        };
                        // rebuild the method to call it again from the string
                        // I could pass the method in right?  But the context of this
                        // changes and I want to use the new this with the real cookie
                        callerParams.push(cb);
                        let properties = caller.split(".");
                        let walker = this.db;
                        properties.forEach((prop) => {
                            walker = walker[prop];
                        });

                        // Try calling the original method again
                        walker.apply(this, callerParams);
                    })
                    .catch((reason) => {
                        logger.error("CallBack error: " + reason);
                        reject(reason);
                    });
            } else {
                this.setHeader(header);
                resolve([err, body, header]);
            }
        });
    }
    handle401(error) {
        return new Promise((resolve, reject) => {
            if (error.statusCode === 401) {
                this.initialize(this.nano.config.url, this.user, this.pass, this.database)
                    .then((response) => {
                        logger.debug("Reauthentication Suceeded");
                        resolve(response);
                    })
                    .catch((reason) => {
                        logger.error("ReAuthentication failed: " + reason);
                        reject(error);
                    });
            } else {
                reject(error);
            }
        });
    }
    initialize(couchURL, user, pass, database) {
        logger.info("Initialized called!");
        this.user = user;
        this.pass = pass;
        this.database = database;
        return new Promise((resolve, reject) => {
            if (user && pass) {
                nano(couchURL).auth(user, pass, (err, body, headers) => {
                    if (err) {
                        logger.error("Auth Error " + err);
                        reject(err);
                    }
                    if (headers && headers["set-cookie"]) {
                        this.authSession = headers["set-cookie"];
                        this.nano = nano({
                            url: couchURL,
                            cookie: this.authSession
                        });
                        if (database) {
                            this.db = this.nano.use(database);
                        }
                        logger.debug("db = " + JSON.stringify(this.db));
                        logger.debug("nano = " + JSON.stringify(this.nano));
                    }
                    resolve([body, headers]);
                });
            } else {
                this.nano = nano(couchURL);
                if (database) {
                    this.db = this.nano.use(database);
                }
                resolve(true);
            }
        });
    }

    use(database) {
        this.database = database;
        this.db = this.nano.use(database);
    }

    get(key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            logger.debug("DB Get called with " + key);
            this.db.get(key, (err, body, header) => {
                this.callBack(err, body, header, "get", key)
                    .then(([err, body, header]) => {
                        resolve(body);
                    })
                    .catch((reason) => {
                        logger.error(reason);
                        reject(reason);
                    });
            });
        });
    }

    fetch(keys) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            logger.debug("DB Fetch called with " + JSON.stringify(keys));
            let qs = {
                keys: keys
            };
            this.db.fetch(qs, (err, body, header) => {
                this.callBack(err, body, header, "fetch", qs)
                    .then(([err, body, header]) => {
                        resolve(body);
                    })
                    .catch((reason) => {
                        logger.error(reason);
                        reject(reason);
                    });
            });
        });
    }
    head(key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            this.db.head(key, (err, _, header) => {
                this.callBack(err, _, header, "head", key)
                    .then(([err, _, header]) => {
                        resolve(header);
                    })
                    .catch((reason) => {
                        logger.error(reason);
                        reject(reason);
                    });
            });
        });
    }
    insert(doc, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            this.db.insert(doc, key, (err, body, header) => {
                this.callBack(err, body, header, "insert", doc, key)
                    .then(([err, body, header]) => {
                        resolve(body);
                    })
                    .catch((reason) => {
                        logger.error(reason);
                        reject(reason);
                    });
            });
        });
    }
    update(doc) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            logger.debug("Sending PUT request" + JSON.stringify(doc));
            this.db.insert(doc, (err, body, header) => {
                logger.info("Calling callback : context of self: " + JSON.stringify(this));
                this.callBack(err, body, header, "insert", doc)
                    .then(([err, body, header]) => {
                        resolve(body);
                    }).catch((reason) => {
                        logger.error(reason);
                        reject(reason);
                    });
            });
        });
    }
    merge(newDoc) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            if (!(newDoc && newDoc._id)) {
                reject("Merge: Document and Key cannot be undefined");
            }
            this.get(newDoc._id)
                .then((body) => {
                    logger.debug("Got existing data " + JSON.stringify(body));
                    let doc = _.assign(body, newDoc);
                    logger.debug("Merged doc: " + JSON.stringify(doc));
                    return this.insert(doc);
                })
                .then((body) => {
                    if (body) {
                        logger.debug("Got Body" + JSON.stringify(body));
                        resolve(body);
                    }
                })
                .catch((reason) => {
                    logger.error(reason);
                    reject(reason);
                });
        });
    }
    delete(key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            if (!key) {
                reject("Delete: Key cannot be undefined");
            }
            logger.debug("Doc Key " + key);
            this.get(key)
                .then((body) => {
                    let doc = _.assign(body, {
                        _deleted: true
                    });
                    logger.debug("Deleted doc: " + JSON.stringify(doc));
                    return this.insert(doc);
                })
                .then((body) => {
                    if (body) {
                        logger.debug("Got Body" + JSON.stringify(body));
                        resolve(body);
                    }
                })
                .catch((reason) => {
                    logger.error(reason);
                    reject(reason);
                });
        });
    }
    replace(doc) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            if (!(doc && doc._id)) {
                reject("Delete: Document and Key cannot be undefined");
            }
            let key = doc._id;
            logger.debug("Doc Key " + key);
            this.head(key).then((header) => {
                this.setHeader(header);
                logger.debug("Head Response: " + JSON.stringify(header));
                doc._rev = header.etag.replace(/"/g, "");
                return this.update(doc);
            }, (reason) => {
                logger.debug("Error Heading: " + reason);
                return this.update(doc);
            }).then((body) => {
                logger.debug("Replace: " + JSON.stringify(body));
                resolve(body);
            }).catch((reason) => {
                logger.error("Replace error: " + reason);
                reject(reason);
            });
        });
    }
    // Here we pass in an array of documents, it should work for create and update
    bulk(docs) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            logger.debug("this.db.bulk sending: \n" + JSON.stringify(docs));
            this.db.bulk({
                docs: docs
            }, (err, body, header) => {
                if (err) {
                    reject(err);
                }
                this.setHeader(header);
                if (body) {
                    logger.debug("Got bulk body response" + JSON.stringify(body));
                    resolve(body);
                }
            });
        });
    }
    setSecurity(securityDoc) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            this.insert(securityDoc, "_security").then((body) => {
                logger.debug(JSON.stringify(body));
            }).catch((reason) => {
                logger.debug(reason);
            });
        });
    }
    // Pass in design doc name, view name and an array of keys
    view(designName, viewName, qs) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            logger.debug("view Query Strings" + JSON.stringify(qs));
            this.db.view(designName, viewName, qs, (err, body, header) => {
                this.callBack(err, body, header, "view", designName, viewName, qs)
                    .then(([err, body, header]) => {
                        resolve(body);
                    })
                    .catch((reason) => {
                        logger.error(reason);
                        reject(reason);
                    });
            });
        });
    }
    request(opts, couchUrl) {
        return new Promise((resolve, reject) => {
            if (this.nano) {
                this.nano.request(opts, (err, body, header) => {
                    this.callBack(err, body, header, "request", opts)
                        .then(([err, body, header]) => {
                            resolve(body);
                        })
                        .catch((reason) => {
                            logger.error(reason);
                            reject(reason);
                        });
                });
            } else {
                nano(couchUrl).request(opts, (err, body, header) => {
                    this.callBack(err, body, header, "request", opts)
                        .then(([err, body, header]) => {
                            resolve(body);
                        })
                        .catch((reason) => {
                            logger.error(reason);
                            reject(reason);
                        });
                });
            }
        });
    }
    getAtt(docName, attName, qs) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            this.db.attachment.get(docName, attName, qs, (err, body, header) => {
                this.callBack(err, body, header, "attachment.get", docName, attName, qs)
                    .then(([err, body, header]) => {
                        resolve(body);
                    })
                    .catch((reason) => {
                        logger.error(reason);
                        reject(reason);
                    });
            });
        });
    }
    addAdmin(couchUrl, user, pass) {
        let opts = {
            db: "_config",
            path: "admins/" + user,
            method: "PUT",
            headers: "Content-Type: application/json",
            body: pass
        };
        return this.request(opts, couchUrl);
    }
}
