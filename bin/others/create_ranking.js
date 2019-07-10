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
  let productIdAndTweetCountRows = (await sequelize.query(
    sprintf(
      "SELECT product_id, count(*) AS count FROM tweet WHERE '%s' <= tweeted_at AND tweeted_at <= '%s' GROUP BY product_id ORDER BY count DESC;",
      tweetSinceMoment.format(),
      tweetUntilMoment.format()
    )
  ))[0];

  var insertObjectBasesForStatData = _.chain(productIdAndTweetCountRows)
    .filter(row => {

      // less than 30 means never over 30 user count
      return CONST.THRESHOLD_COUNT_OF_OUT_OF_RANGE_USER_COUNT <= row.count;
    })
    .map(row => {
      return {
        statId: null, // this will be set in createRanking function
        productId: row.product_id,
        tweetCount: row.count,
        userCount: null, // this will be set after
        buzz: null, // this will be set after
        isInvalid: 0,
      };
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

    var userCount = _.chain(tweetModels).groupBy(tweetModel => {
      return tweetModel.userId;
    }).keys().value().length;

    var buzz = BatchUtil.calcBuzzByTweetModels(tweetModels, tweetUntilMoment);

    data.userCount = userCount;
    data.buzz = buzz;
  }

  await Stat.createRankingData(rankingMoment, tweetSinceMoment, tweetUntilMoment, insertObjectBasesForStatData);

  console.log("finish!");
}
