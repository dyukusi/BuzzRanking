// node create_ranking.js ProductTypeId rankingDate tweetSince tweetUntil productSince productUntil
const appRoot = require('app-root-path');
const {JSDOM} = require('jsdom');
const $ = jQuery = require('jquery')(new JSDOM().window);
const fs = require('fs');
const moment = require('moment');
const _ = require('underscore');
const request = require('request');
const Q = require('q');
const Util = require(appRoot + '/my_libs/util.js');
const QueryString = require('query-string');
const Twitter = require('twitter');
const con = require(appRoot + '/my_libs/db.js');
const async = require('async');
const BatchUtil = require(appRoot + '/my_libs/batch_util.js');

const Tweet = require(appRoot + '/models/tweet.js');
const InvalidProduct = require(appRoot + '/models/invalid_product.js');
const Stat = require(appRoot + '/models/stat.js');

const CONST = require(appRoot + '/my_libs/const.js');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Op = Sequelize.Op;

var rankingMoment = moment(process.argv[2]);
var tweetSinceMoment = moment(rankingMoment).subtract(7, 'days');
var tweetUntilMoment = moment(rankingMoment);

if (!process.argv[2]) {
  throw new Error('pls specify args. node create_ranking.js RankingDate');
}

console.log('ranking date: ' + rankingMoment.format());
console.log('tweet since: ' + tweetSinceMoment.format());
console.log('tweet until: ' + tweetUntilMoment.format());

main()
  .then(() => {
    console.log("Finish!");
  });

async function main() {
  var results = await Promise.all([
    Tweet.findAll({
      where: {
        tweetedAt: {
          [Op.gte]: tweetSinceMoment.format(),
          [Op.lt]: tweetUntilMoment.format(),
        },
        isInvalid: 0,
      },
    }),
    InvalidProduct.findAll(),
  ]);

  var tweetModels = results[0];
  var invalidProductModels = results[1];

  var tweetModelsHash = _.groupBy(tweetModels, m => {
    return m.productId;
  });

  var invalidProductModelHash = _.indexBy(invalidProductModels, m => {
    return m.productId;
  });

  var insertObjectBasesForStatData = [];

  _.each(tweetModelsHash, (tweetModels, productId) => {
    if (invalidProductModelHash[productId]) return;

    var tweetCount = tweetModels.length;
    var userCount = _.chain(tweetModels).groupBy(tweetModel => {
      return tweetModel.userId;
    }).keys().value().length;

    if (userCount < CONST.THRESHOLD_COUNT_OF_OUT_OF_RANGE_USER_COUNT) return;

    insertObjectBasesForStatData.push({
      statId: null, // this will be set in createRanking function
      productId: productId,
      tweetCount: tweetCount,
      userCount: userCount,
      isInvalid: 0,
    });
  });

  await Stat.createRankingData(rankingMoment, tweetSinceMoment, tweetUntilMoment, insertObjectBasesForStatData);

  console.log("finish!");
}
