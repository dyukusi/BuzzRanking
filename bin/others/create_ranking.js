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
  var isNoBuzzThresholdProductIdHash = await createIsNoBuzzThresholdProductIdHash();

  let productIdAndTweetCountRows = (await sequelize.query(
    sprintf(
      "SELECT product_id, count(*) AS count FROM tweet WHERE product_id NOT IN (SELECT product_id FROM invalid_product) AND '%s' <= tweeted_at AND tweeted_at <= '%s' GROUP BY product_id ORDER BY count DESC;",
      tweetSinceMoment.format(),
      tweetUntilMoment.format()
    )
  ))[0];

  var insertObjectBasesForStatData = _.chain(productIdAndTweetCountRows)
    .filter(row => {
      return CONST.THRESHOLD_COUNT_OF_OUT_OF_RANGE_USER_COUNT <= row.count;
    })
    .map(row => {
      return createInsertObjectBaseForStatData(null, row.product_id, row.count, null, false);
    })
    .value();

  for (var i = 0; i < insertObjectBasesForStatData.length; i++) {
    var data = insertObjectBasesForStatData[i];

    var tweetModels = await Tweet.findAll({
      where: {
        productId: data.productId,
        tweetedAt: {
          [Op.gte]: tweetSinceMoment.format(),
          [Op.lt]: tweetUntilMoment.format(),
        },
        isInvalid: 0,
      },
    });

    var buzz = BatchUtil.calcBuzzByTweetModels(tweetModels, tweetUntilMoment);
    data.buzz = buzz;
  }

  var insertObjectBasesForStatDataHash = _.indexBy(insertObjectBasesForStatData, data => {
    return data.productId;
  });

  // add missed products
  _.each(_.keys(isNoBuzzThresholdProductIdHash), productId => {
    if (!insertObjectBasesForStatDataHash[productId]) {
      insertObjectBasesForStatData.push(createInsertObjectBaseForStatData(null, productId, 0, 0, false));
    }
  });

  // exclude worthless products
  insertObjectBasesForStatData = _.filter(insertObjectBasesForStatData, data => {
    if (!isNoBuzzThresholdProductIdHash[data.productId]) {
      return 30 <= data.buzz;
    }

    return true;
  });

  await Stat.createRankingData(rankingMoment, tweetSinceMoment, tweetUntilMoment, insertObjectBasesForStatData);

  console.log("finish!");
}

async function createIsNoBuzzThresholdProductIdHash() {
  var productModels = await Util.selectProductModelsByProductTypeIds(CONST.EXCEPTION_NO_BUZZ_NUM_THRESHOLD_PRODUCT_TYPE_IDS);

  var productIds = _.map(productModels, m => {
    return m.productId;
  });

  var isNoBuzzThresholdProductIdHash = _.indexBy(productIds, productId => {
    return productId;
  });

  return isNoBuzzThresholdProductIdHash;
}

function createInsertObjectBaseForStatData(statId, productId, tweetCount, buzz, isInvalid) {
  return {
    statId: statId,
    productId: productId,
    tweetCount: tweetCount,
    buzz: buzz,
    isInvalid: isInvalid,
  };
}
