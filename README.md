# couch-configure
A simple set of utilities that sit on top of Nano for interfacing with couchDB.

## Installation
```bash
npm i --save-dev couch-configure
```

## Functions
The following functions work just like thier Nano counterparts, except they return a promise and reject on err:
# fetch
# merge
# replace
# head
# insert
# initialize
Initialize will set up Nano to authenticate to the couchdb.  Pass in the couchdb url, username, pass and database name.
```js
couchdb.initialize("http://localhost:5984", "admin", "pass", "database").then(function (response) {
}, function (reason) {
});
```
# update
The following functions extend Nano functionality 
# merge
  Merge will get the latest document matching the _id of your new document.  Then it will copy over the top level properties from your object into the document and update it.
  No _rev is needed.
```js
 couch.merge ({_id: "19191", name: "Steve"}).then( function (body) {
        console.log(JSON.stringify(body));
    }, function (err) {
        console.log(err);
    });
```
# replace
Input a document with an _id to update.  Replace will get the latest revision and update it with the input document.
No _rev is needed. 
```js
couch.replace({_id: "19191", name: "Steve", weight: "130"}).then( function (body) {
        console.log(JSON.stringify(body));
    }, function (err) {
        console.log(err);
    });
```
# delete
Input a document Id as the key and delete will delete the latest rev of this document.
No _rev is needed
couch.delete("19191").then( function (body) {
        console.log(JSON.stringify(body));
    }, function (err) {
        console.log(err);
    });
