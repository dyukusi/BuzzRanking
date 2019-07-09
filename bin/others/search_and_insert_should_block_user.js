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

var sqls = [
  "INSERT IGNORE INTO block_twitter_user (screen_name) SELECT DISTINCT screen_name FROM tweet WHERE screen_name LIKE '%animate%'",
  "INSERT IGNORE INTO block_twitter_user (screen_name) SELECT DISTINCT screen_name FROM tweet WHERE name LIKE '%アニメイト%'",
  "INSERT IGNORE INTO block_twitter_user (screen_name) SELECT DISTINCT screen_name FROM tweet WHERE name LIKE '%店%'",
  "INSERT IGNORE INTO block_twitter_user (screen_name) SELECT DISTINCT screen_name FROM tweet WHERE name LIKE '%イオン%'",
  "INSERT IGNORE INTO block_twitter_user (screen_name) SELECT DISTINCT screen_name FROM tweet WHERE name LIKE '%タワーレコード%'",
  "INSERT IGNORE INTO block_twitter_user (screen_name) SELECT DISTINCT screen_name FROM tweet WHERE name LIKE '%集英社%'",
  "INSERT IGNORE INTO block_twitter_user (screen_name) SELECT DISTINCT screen_name FROM tweet WHERE name LIKE '%公式%'",
];

Q.allSettled(_.map(sqls, sql => {
  return executeStaticSQL(sql);
}))
  .then(results => {
    console.log("All static query task finished");
    con.end();
  });

function executeStaticSQL(sql) {
  var d = Q.defer();

  con.query(sql, [], (e, rows, fields) => {
      if (e) {
        throw new Error(e);
        return;
      }
      console.log('Finished: ' + sql);
      d.resolve();
    }
  );

  return d.promise;
}
