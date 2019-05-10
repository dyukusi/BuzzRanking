const appRoot = require('app-root-path');
const {JSDOM} = require('jsdom');
const $ = jQuery = require('jquery')(new JSDOM().window);
const fs = require('fs');
const _ = require('underscore');
const request = require('request');
const Q = require('q');
const Util = require(appRoot + '/my_libs/util.js');
const QueryString = require('query-string');
const Twitter = require('twitter');
const con = require(appRoot + '/my_libs/db.js');
const async = require('async');

const ReleaseControlModel = require(appRoot + '/models/release_control.js');

if (!process.argv[2] || !process.argv[3]) {
  throw new Error('pls specify args. ex.. node hoge.js 1 2019-04-28');
}

var targetProductTypeId = Number(process.argv[2]);
var targetDate = new Date(process.argv[3]);

if (targetDate.toString() == 'Invalid Date') {
  throw new Error('invalid date: ' + process.argv[3]);
}

ReleaseControlModel.updateCurrentReleaseDate(targetProductTypeId, targetDate)
  .then(() => {
    con.end();
    console.log("Finished! ProductTypeId:" + targetProductTypeId + " date:" +targetDate.toLocaleDateString());
  });
