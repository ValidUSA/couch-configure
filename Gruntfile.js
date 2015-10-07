/* global module */
module.exports = function (grunt) {
    "use strict";

    grunt.loadNpmTasks("grunt-babel");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-jscs");
    grunt.loadNpmTasks("grunt-mocha-test");

    grunt.initConfig({
        babel: {
            options: {
                sourceMap: true,
                stage: 0
            },
            files: {
                expand: true,
                src: ["**/*.es6"],
                ext: "-compiled.js"
            }
        },
        pkg: grunt.file.readJSON("package.json"),
        jshint: {
            options: {
                jshintrc: ".jshintrc",
                ignores: ["lib/**/*-compiled.js"]
            },
            files: {
                src: ["Gruntfile.js", "lib/**/*.js", "lib/**/*.es6", "test/**/*.js"]
            }
        },
        jscs: {
            src: ["Gruntfile.js", "lib/**/*.js", "lib/**/*.es6", "test/*.js"],
            options: {
                config: ".jscsrc",
                excludeFiles: ["lib/**/*-compiled.js"]
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
        },
        clean: {
            build: ["build"]
        },
        copy: {
            build: {
                files: [
                    {
                        expand: true,
                        cwd: "lib/",
                        src: ["**", "!config/**"], // exclude scss folder and contents of js folder
                        dest: "build/"
                    }
                ]
            }
        }
    });
    grunt.registerTask("compile", ["babel"]);
    grunt.registerTask("default", [
        "babel",
        "jshint",
        "jscs",
        "clean",
        "copy",
        "strip_code"
    ]);

    grunt.registerTask("quick", [
        "babel",
        "jshint",
        "jscs",
        "clean",
        "copy"
    ]);

    grunt.registerTask("test", [
        "babel",
        "jshint",
        "jscs",
        "clean",
        "copy",
        "mochaTest"
    ]);
};
