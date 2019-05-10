// node create_ranking.js ProductTypeId rankingDate tweetSince tweetUntil productSince productUntil
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
const BatchUtil = require(appRoot + '/my_libs/batch_util.js');
const StatModel = require(appRoot + '/models/stat.js');
const TweetModel = require(appRoot + '/models/tweet.js');

var targetProductTypeId = Number(process.argv[2]);
var rankingDate = new Date(process.argv[3]);
var since = new Date(process.argv[4]);
var until = new Date(process.argv[5]);
var productSince = new Date(process.argv[6]);
var productUntil = new Date(process.argv[7]);

if (!process.argv[2] || !process.argv[3] || !process.argv[4] || !process.argv[5] || !process.argv[6] || !process.argv[7]) {
  throw new Error('pls specify args. node create_ranking.js ProductTypeId RankingDate TweetSince TweetUntil ProductSince ProductUntil');
}

console.log('ranking date: ' + rankingDate.toLocaleDateString());
console.log('since: ' + since.toLocaleDateString());
console.log('until: ' + until.toLocaleDateString());
console.log('product since: ' + productSince.toLocaleDateString());
console.log('product until: ' + productUntil.toLocaleDateString());

BatchUtil.getProductModels(targetProductTypeId, productSince, productUntil)
  .then(targetProductsHash => {
    var isTargetProductHash = {};
    _.chain(targetProductsHash)
      .values()
      .flatten()
      .each(m => {
        isTargetProductHash[m.getProductId] = true;
      });


    createRanking(
      isTargetProductHash,
      targetProductTypeId,
      since,
      until,
    ).then(function () {
      console.log('done!');
      return;
    });
  });

function createRanking(isTargetProductHash, targetProductTypeId, since, until) {
  var d = Q.defer();
  var that = this;

  async.waterfall([
      (callback) => {

        TweetModel.selectByProductTypeId(targetProductTypeId, {
          since: since,
          until: until,
        })
          .then(allTweetModels => {
            var targetTweetModels = _.filter(allTweetModels, m => {
              return isTargetProductHash[m.getProductId()];
            });

            var productIdIntoTweetModelsHash = _.groupBy(targetTweetModels, m => {
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
