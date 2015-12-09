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
    handle401(error) {
        return new Promise((resolve, reject) => {
            if (error.statusCode === 401) {
                this.initialize(this.nano.config.url, this.user, this.pass, this.database)
                    .then((response) => {
                        logger.warn("Reauthentication Suceeded");
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
                    }
                    resolve([body, headers]);
                });
            } else {
                this.nano = nano(couchURL);
                if (database) {
                    this.db = this.nano.use(database);
                    resolve(true);
                }
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
                if (err) {
                    reject(err);
                }
                this.setHeader(header);
                resolve(body);
            });
        });
    }

    fetch(keys) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            logger.debug("DB Fetch called with " + JSON.stringify(keys));
            this.db.fetch({
                keys: keys
            }, (err, body, header) => {
                if (err) {
                    reject(err);
                }
                this.setHeader(header);
                resolve(body);
            });
        });
    }
    head(key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            this.db.head(key, (err, _, headers) => {
                if (err) {
                    reject(err);
                }
                if (headers) {
                    this.setHeader(headers);
                    logger.debug("Got Headers: " + JSON.stringify(headers));
                    resolve(headers);
                }
            });
        });
    }
    insert(doc, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            this.db.insert(doc, key, (err, body, header) => {
                if (err) {
                    reject(err);
                }
                this.setHeader(header);
                resolve(body);
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
                if (err) {
                    this.handle401(err)
                    .then((response)=> {
                        this.db.insert(doc, (err, body, header) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(body);
                            return;
                        });
                    }).catch((reason)=> {
                        reject(err);
                    });
                } else {
                    this.setHeader(header);
                    resolve(body);
                }
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
            this.db.get(newDoc._id, (err, body, header) => {
                if (err) {
                    reject("merge error: " + err);
                }
                this.setHeader(header);
                logger.debug("Got existing data " + JSON.stringify(body));
                let doc = _.assign(body, newDoc);
                logger.debug("Merged doc: " + JSON.stringify(doc));
                this.db.insert(doc, (err, body, header) => {
                    if (err) {
                        reject(err);
                    }
                    this.setHeader(header);
                    if (body) {
                        logger.debug("Got Body" + JSON.stringify(body));
                        resolve(body);
                    }
                });
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
            this.db.get(key, (err, body, header) => {
                if (err) {
                    reject("Delete error: " + err);
                }
                this.setHeader(header);
                logger.debug("Found Doc " + JSON.stringify(body));
                let doc = _.assign(body, {
                    _deleted: true
                });
                logger.debug("Deleted doc: " + JSON.stringify(doc));
                this.db.insert(doc, (err, body, header) => {
                    if (err) {
                        reject(err);
                    }
                    this.setHeader(header);
                    if (body) {
                        logger.debug("Got Body" + JSON.stringify(body));
                        resolve(body);
                    }
                });
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
            this.db.insert(securityDoc, "_security").then((body) => {
                logger.debug(JSON.stringify(body));
            }).catch((reason) => {
                logger.debug(reason);
            });
        });
    }
    // Pass in design doc name, view name and an array of keys
    view(designName, viewName, keys) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            this.db.view(designName, viewName, keys, (err, body, header) => {
                if (err) {
                    reject(err);
                }
                this.setHeader(header);
                resolve(body);
            });
        });
    }
    request(opts, couchUrl) {
        return new Promise((resolve, reject) => {
            if (this.nano) {
                this.nano.request(opts, (err, body, header) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(body);
                    }
                });
            } else {
                nano(couchUrl).request(opts, (err, body, header) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(body);
                    }
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
                if (err) {
                    reject(err);
                } else {
                    this.setHeader(header);
                    resolve(body);
                }
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
