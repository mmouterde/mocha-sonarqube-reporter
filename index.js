'use strict';
const fs = require('fs');
const util = require('util');
const path = require("path");

const mkdirp = require("mkdirp");
const xmlescape = require('xml-escape');

module.exports = function (runner) {

    var stack = {};
    var title, fd;
    var root = process.cwd();
    var filePath = process.env.GUNIT_FILE || root + "/gunit.xml";
    var stackF;
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    mkdirp.sync(path.dirname(filePath));
    fd = fs.openSync(filePath, 'w');
    runner.on('test end', function (test) {
        var file = getFilePath(test);
        file = file.substr(file.indexOf(root) + root.length + 1);
        stackF = stack[file];
        if (!stackF) {
            stackF = stack[file] = [];
        }
        var mtest = {
            title: test.title,
            titleId: title + ': ' + test.title,
            suite: title,
            stack: test.stack,
            message: test.message,
            file: file,
            duration: test.duration,
            state: test.state != undefined ? test.state : 'skipped'
        };
        stackF.push(mtest);
    });

    runner.on('suite', function (test) {
        title = test.title;
    });

    runner.on('fail', function (test, err) {
        test.stack = err.stack;
        test.message = err.message;
    });

    runner.on('end', function () {
        append('<testExecutions version="1">');
        Object.keys(stack).forEach(function (file) {
            append(util.format('<file path="%s">', file));
            stack[file].forEach(function (test) {
                switch (test.state) {
                    case 'passed':
                        append(util.format(
                            '<testCase name="%s" duration="%d"/>',
                            xmlescape(test.titleId), test.duration
                        ));
                        break;
                    default :
                        append(util.format(
                            '<testCase name="%s" duration="%d">',
                            xmlescape(test.titleId), test.duration != undefined ? test.duration : 0
                        ));
                        switch (test.state) {
                            case 'failed':
                                append(util.format(
                                    '<failure message="%s"><![CDATA[%s]]></failure>',
                                    xmlescape(test.message), test.stack
                                ));
                                break;
                            case 'skipped':
                                append(util.format(
                                    '<skipped message="%s"></skipped>', xmlescape(test.title)
                                ));
                                break;
                        }
                        append('</testCase>');
                }
            });
            append('</file>');
        });
        append('</testExecutions>');
        fs.closeSync(fd);
    });
    function append(str) {
        fs.writeSync(fd, str + "\n", null, 'utf8');
    }
};

function getFilePath(testObj) {
    if (testObj.file) {
        return testObj.file;
    }
    if (testObj.parent.title == '') {
        return testObj.title;
    }
    else {
        return getFilePath(testObj.parent);
    }
}