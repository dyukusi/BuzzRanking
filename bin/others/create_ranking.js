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

const StatModel = require(appRoot + '/models/stat.js');
const TweetModel = require(appRoot + '/models/tweet.js');

if (!process.argv[2] || !process.argv[3] || !process.argv[4]) {
  console.log('pls specify args. ex.. node hoge.js 2 2019-04-29 2019-04-28 2019-05-03');
  return;
}

var targetProductTypeId = Number(process.argv[2]);
var rankingDate = new Date(process.argv[3]);
var since = new Date(process.argv[4]);
var until = new Date(process.argv[5]);

console.log('ranking date: ' + rankingDate.toLocaleDateString());
console.log('since: ' + since.toLocaleDateString());
console.log('until: ' + until.toLocaleDateString());

createRanking(
  targetProductTypeId,
  since,
  until,
).then(function () {
  console.log('done!');
  return;
});

function createRanking(targetProductTypeId, since, until) {
  var d = Q.defer();
  var that = this;

  async.waterfall([
      (callback) => {

        TweetModel.selectByProductTypeId(targetProductTypeId, {
          since: since,
          until: until,
        })
          .then(tweetModels => {
            var productIdIntoTweetModelsHash = _.groupBy(tweetModels, m => {
              return m.getProductId();
            });

            var insertObjectForRankingDataTemp = _.map(productIdIntoTweetModelsHash, (tweetModels, productId) => {
              return {
                // ranking_id: null,
                product_id: Number(productId),
                tweet_count: Number(tweetModels.length),
                user_count: _.uniq(tweetModels, m => {
                  return m.getScreenName();
                }).length,
                is_invalid: 0,
              };
            });

            callback(null, insertObjectForRankingDataTemp);
          });
      },
      (insertObjectForRankingDataTemp, callback) => {
        StatModel.createRankingData(targetProductTypeId, rankingDate, since, until, insertObjectForRankingDataTemp)
          .then((rankingId) => {
            console.log('new ranking was successfully created! RankingId: ' + rankingId);
            callback(null);
          });
      }],
    (e) => {
      con.end();

      if (e) {
        console.log(e);
        return d.reject();
      }

      return d.resolve();
    }
  );

  return d.promise;
}
