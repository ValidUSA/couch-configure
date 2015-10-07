/* global module */
module.exports = function (grunt) {
    "use strict";

    grunt.loadNpmTasks("grunt-babel");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-jscs");
    grunt.loadNpmTasks("grunt-mocha-test");

    grunt.initConfig({
        babel: {
            options: {
                sourceMap: true,
                stage: 0
            },
            dist: {
                files: {
                    "lib/couchConfigure.js": "src/couchConfigure.es6"
                }
            }
        },
        pkg: grunt.file.readJSON("package.json"),
        jshint: {
            options: {
                jshintrc: ".jshintrc"
            },
            files: {
                src: ["Gruntfile.js", "src/**/*.js", "src/**/*.es6", "test/**/*.js"]
            }
        },
        jscs: {
            src: ["Gruntfile.js", "src/**/*.js", "src/**/*.es6", "test/*.js"],
            options: {
                config: ".jscsrc"
            }
        },
        // Configure a mochaTest task
        mochaTest: {
            test: {
                options: {
                    reporter: "spec",
                    captureFile: "results.txt", // Optionally capture the reporter output to a file
                    quiet: false, // Optionally suppress output to standard out (defaults to false)
                    clearRequireCache: false // Optionally clear the require cache before running tests (defaults to false)
                },
                src: ["test/**/*.js"]
            }
        }
    });
    grunt.registerTask("compile", ["babel"]);
    grunt.registerTask("default", [
        "babel",
        "jshint",
        "jscs",
        "strip_code"
    ]);

    grunt.registerTask("quick", [
        "babel",
        "jshint",
        "jscs"
    ]);

    grunt.registerTask("test", [
        "babel",
        "jshint",
        "jscs",
        "mochaTest"
    ]);
};
