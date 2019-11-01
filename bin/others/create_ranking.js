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
const sprintf = require('sprintf-js').sprintf;

const NewTweet = require(appRoot + '/models/new_tweet.js');
const Stat = require(appRoot + '/models/stat.js');

const CONST = require(appRoot + '/my_libs/const.js');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Op = Sequelize.Op;

const RANK_IN_BUZZ_THRESHOLD = 30;
var rankingMoment = moment(process.argv[2]);
var tweetSinceMoment = moment(rankingMoment).subtract(7, 'days');
var tweetUntilMoment = moment(rankingMoment);

if (!process.argv[2]) {
  throw new Error('pls specify args. node create_ranking.js RankingDate');
}

console.log('ranking date: ' + rankingMoment.format());
console.log('tweet since(<=): ' + tweetSinceMoment.format());
console.log('tweet until(<): ' + tweetUntilMoment.format());

main()
  .then(() => {
    console.log("Finish!");
  });

async function main() {
  var isNoBuzzThresholdProductIdHash = await createIsNoBuzzThresholdProductIdHash();

  console.log("finding high buzz product candidates");
  var productIdAndOriginalTweetCountRows = (await sequelize.query(
    sprintf(
      "SELECT * FROM (SELECT product_id, count(*) AS count FROM new_tweet WHERE product_id NOT IN (SELECT product_id FROM invalid_product) AND '%s' <= tweeted_at AND tweeted_at <= '%s' GROUP BY product_id ORDER BY count DESC) AS temp WHERE %d <= count;",
      tweetSinceMoment.format("YYYY-MM-DD"),
      tweetUntilMoment.format("YYYY-MM-DD"),
      RANK_IN_BUZZ_THRESHOLD
    )
  ))[0];

  // let productIdAndBuzzRows = (await sequelize.query(
  //   sprintf(
  //     "SELECT TweetCountLogA.product_id, TweetCountLogA.buzz, TweetCountLogA.created_at FROM tweet_count_log AS TweetCountLogA INNER JOIN (SELECT product_id, MAX(created_at) AS latest_date FROM tweet_count_log WHERE '%s' <= created_at AND created_at < '%s' GROUP BY product_id) AS TweetCountLogB ON TweetCountLogA.product_id = TweetCountLogB.product_id AND TweetCountLogA.created_at = TweetCountLogB.latest_date WHERE TweetCountLogA.product_id NOT IN (SELECT product_id FROM invalid_product) AND %d <= TweetCountLogA.buzz ORDER BY TweetCountLogA.buzz DESC;",
  //     tweetSinceMoment.format("YYYY-MM-DD"),
  //     tweetUntilMoment.format("YYYY-MM-DD"),
  //     RANK_IN_BUZZ_THRESHOLD
  //   )
  // ))[0];

  var candidateProductIdHash = _.indexBy(productIdAndOriginalTweetCountRows, row => {
    return row.product_id;
  });

  // add missed products
  _.each(_.keys(isNoBuzzThresholdProductIdHash), productId => {
    if (!candidateProductIdHash[productId]) {
      candidateProductIdHash[productId] = true;
    }
  });

  var candidateProductIds = _.keys(candidateProductIdHash);

  console.log("selecting tweets");
  var mixedTweetModels = await NewTweet.selectByProductIds(
    candidateProductIds,
    {
      since: tweetSinceMoment,
      until: tweetUntilMoment,
    }
  );

  var productIdIntoTweetModels = _.groupBy(mixedTweetModels, m => {
    return m.productId;
  });

  var productIdIntoInsertObjectBaseForStatData = {};

  console.log("creating stat data objects");
  for (var i = 0; i < candidateProductIds.length; i++) {
    var productId = candidateProductIds[i];
    var tweetModels = productIdIntoTweetModels[productId] || [];
    var tweetCount = _.reduce(tweetModels, (memo, model) => {
      return memo + (1 + model.retweetCount);
    }, 0);
    var buzz = BatchUtil.calcBuzzByTweetModels(tweetModels, tweetUntilMoment);

    if (!isNoBuzzThresholdProductIdHash[productId] && buzz < RANK_IN_BUZZ_THRESHOLD) continue;
    productIdIntoInsertObjectBaseForStatData[productId] = createInsertObjectBaseForStatData(productId, tweetCount, buzz);
  }

  console.log("creating ranking");

  await Stat.createRankingData(rankingMoment, tweetSinceMoment, tweetUntilMoment, _.values(productIdIntoInsertObjectBaseForStatData));

  console.log("finish!");
}

async function createIsNoBuzzThresholdProductIdHash() {
  var productModels = await Util.selectProductModels({
    productTypeId: CONST.EXCEPTION_NO_BUZZ_NUM_THRESHOLD_PRODUCT_TYPE_IDS,
  });

  var productIds = _.map(productModels, m => {
    return m.productId;
  });

  var isNoBuzzThresholdProductIdHash = _.indexBy(productIds, productId => {
    return productId;
  });

  return isNoBuzzThresholdProductIdHash;
}

function createInsertObjectBaseForStatData(productId, tweetCount, buzz) {
  return {
    statId: null,
    productId: productId,
    tweetCount: tweetCount,
    buzz: buzz,
    isInvalid: 0,
  };
}
