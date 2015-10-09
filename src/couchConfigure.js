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
    initialize (couchURL, user, pass, database) {
        logger.info("Initialized called!");
        return new Promise (
            (resolve, reject)=> {
                nano(couchURL).auth(user, pass, (err, body, headers)=> {
                    if (err) {
                        logger.error("Auth Error "  + err);
                        reject(err);
                    }
                    if (headers && headers["set-cookie"]) {
                        this.authSession = headers["set-cookie"];
                        this.nano = nano({
                            url : couchURL,
                            cookie: this.authSession
                        });
                        if (database) {
                            this.db = this.nano.use(database);
                        }
                    }
                    resolve([body, headers]);
                });
            }
        );
    }

    use (database) {
        this.db = this.nano.use(database);
    }

    get (key) {
        return new Promise ((resolve, reject)=> {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            logger.debug("DB Get called with " + key);
            this.db.get(key, (err, body)=> {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.debug("Got a body " + JSON.stringify(body));
                    resolve(body);
                }
            });
        });
    }

    fetch (keys) {
        return new Promise ((resolve, reject)=> {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            logger.debug("DB Fetch called with " + JSON.stringify(keys));
            this.db.fetch({
                keys: keys
            }, (err, body)=> {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.debug("Fetch return body " + JSON.stringify(body));
                    resolve(body);
                }
            });
        });
    }
    head (key) {
        return new Promise ((resolve, reject)=> {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            this.db.head(key, (err, _, headers)=> {
                if (err) {
                    reject(err);
                }
                if (headers) {
                    logger.debug("Got Headers: " + JSON.stringify(headers));
                    resolve(headers);
                }
            });
        });
    }
    insert (doc, key) {
        return new Promise ((resolve, reject)=> {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            this.db.insert(doc, key, (err, body)=> {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.debug("Got Body" + JSON.stringify(body));
                    resolve(body);
                }
            });
        });
    }
    update (doc) {
        return new Promise ((resolve, reject)=> {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            logger.debug("Sending PUT request" + JSON.stringify(doc));
            this.db.insert(doc, (err, body)=> {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.debug("Got Body" + JSON.stringify(body));
                    resolve(body);
                }
            });
        });
    }
    merge (newDoc) {
        return new Promise ((resolve, reject)=> {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            if (!(newDoc && newDoc._id)) {
                reject("Merge: Document and Key cannot be undefined");
            }
            this.db.get(newDoc._id, (err, body)=> {
                if (err) {
                    reject("merge error: " + err);
                }
                logger.debug("Got existing data " + JSON.stringify(body));
                let doc = _.assign(body, newDoc);
                logger.debug("Merged doc: " + JSON.stringify(doc));
                this.db.insert(doc, (err, body)=> {
                    if (err) {
                        reject(err);
                    }
                    if (body) {
                        logger.debug("Got Body" + JSON.stringify(body));
                        resolve(body);
                    }
                });
            });
        });
    }
    delete (key) {
        return new Promise ((resolve, reject)=> {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            if (!key) {
                reject("Delete: Key cannot be undefined");
            }
            logger.debug("Doc Key " + key);
            this.db.get(key, (err, body)=> {
                if (err) {
                    reject("Delete error: " + err);
                }
                logger.debug("Found Doc " + JSON.stringify(body));
                let doc = _.assign(body, {
                    _deleted: true
                });
                logger.debug("Deleted doc: " + JSON.stringify(doc));
                this.db.insert(doc, (err, body)=> {
                    if (err) {
                        reject(err);
                    }
                    if (body) {
                        logger.debug("Got Body" + JSON.stringify(body));
                        resolve(body);
                    }
                });
            });
        });
    }
    replace (doc) {
        return new Promise ((resolve, reject)=> {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            if (!(doc && doc._id)) {
                reject("Delete: Document and Key cannot be undefined");
            }
            let key = doc._id;
            logger.debug("Doc Key " + key);
            this.head(key).then((header)=> {
                logger.debug("Head Response: " + JSON.stringify(header));
                doc._rev = header.etag.replace(/"/g, "");
                return this.update(doc);
            }, (reason)=> {
                logger.debug("Error Heading: " + reason);
                return this.update(doc);
            }).then((body)=> {
                logger.debug("Replace: " + JSON.stringify(body));
                resolve(body);
            }).catch ((reason)=> {
                logger.error("Replace error: " + reason);
                reject(reason);
            });
        });
    }
    // Here we pass in an array of documents, it should work for create and update
    bulk (docs) {
        return new Promise ((resolve, reject)=> {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            logger.debug("this.db.bulk sending: \n" + JSON.stringify(docs));
            this.db.bulk({
                docs: docs
            }, (err, body)=> {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.debug("Got bulk body response" + JSON.stringify(body));
                    resolve(body);
                }
            });
        });
    }
    setSecurity (securityDoc) {
        return new Promise ((resolve, reject)=> {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            this.db.insert(securityDoc, "_security").then((body)=> {
                logger.debug(JSON.stringify(body));
            }).catch((reason)=> {
                logger.debug(reason);
            });
        });
    }
    // Pass in design doc name, view name and an array of keys
    view (designName, viewName, keys) {
        return new Promise ((resolve, reject)=> {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            this.db.view(designName, viewName, {
                keys: keys
            }, (err, body)=> {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.debug("View Body" + JSON.stringify(body) + "\n db" + JSON.stringify(this.db));
                    let ids = [];
                    body.rows.forEach((viewRow)=> {
                        ids.push(viewRow.id);
                    });
                    resolve(ids);
                }
            });
        });
    }
}
