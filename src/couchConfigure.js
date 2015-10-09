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
        return new Promise (
            (resolve, reject)=> {
                nano(couchURL).auth(user, pass, (err, body, headers)=> {
                    if (err) {
                        logger.error("Auth Error "  + err);
                        reject(err);
                    }
                    if (headers && headers["set-cookie"]) {
                        this.auth = headers["set-cookie"];
                        this.db = nano({
                            url : couchURL + "/" + database, cookie: this.auth
                        });
                    }
                    resolve([body, headers]);
                });
            }
        );
    }

    get (key) {
        return new Promise ((resolve, reject)=> {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            logger.info("DB Get called with " + key);
            this.db.get(key, (err, body, header)=> {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.info("Got a body " + JSON.stringify(body));
                    resolve([body, header]);
                }
            });
        });
    }

    fetch (keys) {
        return new Promise ((resolve, reject)=> {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            logger.info("DB Fetch called with " + JSON.stringify(keys));
            this.db.fetch({
                keys: keys
            }, (err, body, header)=> {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.silly("Fetch return body " + JSON.stringify(body));
                    resolve([body, header]);
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
                    logger.silly("Got Headers: " + JSON.stringify(headers));
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
            this.db.insert(doc, key, (err, body, header)=> {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.silly("Got Body" + JSON.stringify(body));
                    resolve([body, header]);
                }
            });
        });
    }
    update (doc) {
        return new Promise ((resolve, reject)=> {
            if (!this.db) {
                reject("No database configured.  Please Run initialize " + this.db);
            }
            logger.info("Sending PUT request" + JSON.stringify(doc));
            this.db.insert(doc, (err, body, header)=> {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.info("Got Body" + JSON.stringify(body));
                    resolve([body, header]);
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
            this.db.get(newDoc._id, (err, body, header)=> {
                if (err) {
                    reject("merge error: " + err);
                }
                logger.info("Go existing data " + JSON.stringify(body));
                let doc = _.assign(body, newDoc);
                logger.info("Merged doc: " + JSON.stringify(doc));
                this.db.insert(doc, (err, body, header)=> {
                    if (err) {
                        reject(err);
                    }
                    if (body) {
                        logger.info("Got Body" + JSON.stringify(body));
                        resolve([body, header]);
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
            logger.info("Doc Key " + key);
            this.db.get(key, (err, body, header)=> {
                if (err) {
                    reject("Delete error: " + err);
                }
                logger.info("Found Doc " + JSON.stringify(body));
                let doc = _.assign(body, {
                    _deleted: true
                });
                logger.info("Deleted doc: " + JSON.stringify(doc));
                this.db.insert(doc, (err, body, header)=> {
                    if (err) {
                        reject(err);
                    }
                    if (body) {
                        logger.info("Got Body" + JSON.stringify(body));
                        resolve([body, header]);
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
            logger.info("Doc Key " + key);
            this.head(key).then((body)=> {
                logger.info("Head Response: " + JSON.stringify(body));
                doc._rev = body.etag.replace(/"/g, "");
                return this.update(doc);
            }, (reason)=> {
                logger.info("Error Heading: " + reason);
                return this.update(doc);
            }).then((body, header)=> {
                logger.info("Replace: " + JSON.stringify(body));
                resolve([body, header]);
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
            logger.silly("this.db.bulk sending: \n" + JSON.stringify(docs));
            this.db.bulk({
                docs: docs
            }, (err, body, header)=> {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.silly("Got bulk body response" + JSON.stringify(body));
                    resolve([body, header]);
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
                logger.info(JSON.stringify(body));
            }).catch((reason)=> {
                logger.info(reason);
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
            }, (err, body, header)=> {
                if (err) {
                    reject(err);
                }
                if (body) {
                    logger.silly("View Body" + JSON.stringify(body) + "\n db" + JSON.stringify(this.db));
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
