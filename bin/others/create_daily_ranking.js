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

const DailyBookRankingModel = require(appRoot + '/models/daily_book_ranking.js');

DailyBookRankingModel.createDailyBookRanking(new Date())
  .then(function() {
    console.log('done');
  });
