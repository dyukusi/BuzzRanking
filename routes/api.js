const appRoot = require('app-root-path');
const express = require('express');
const router = express.Router();
const NewTweet = require(appRoot + '/models/new_tweet');
const cacheUtil = require(appRoot + '/my_libs/cache_util.js');
const Moment = require('moment');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');
const BlockTwitterUser = require(appRoot + '/models/block_twitter_user');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');

function isAdmin(req, res, next) {
  var email = req.user ? req.user.email : null;

  if (email == Config.admin_gmail_address) {
    return next();
  }
  else {
    res.redirect('/auth');
  }
}

router.get('/product/buzz_chart_data', async function (req, res, next) {
  var q = req.query;
  var productId = Number(q.productId);
  var cacheKey = cacheUtil.generateChartDataCacheKey(productId);
  var cache = await redis.get(cacheKey);

  if (cache) {
    res.send(cache);
    return;
  }

  console.log("cache miss: " + cacheKey);

  let tweetCountPerDayRows = (await sequelize.query(
    "SELECT DATE(tweeted_at) AS date, COUNT(*) AS count FROM new_tweet WHERE product_id = :productId GROUP BY DATE(tweeted_at) ORDER BY date ASC",
    {
      replacements: {
        productId: productId,
      },
      type: Sequelize.QueryTypes.SELECT,
    }
  ));

  let buzzPerDayRows = (await sequelize.query(
    "SELECT DATE(TweetCountLogA.created_at) AS date, TweetCountLogA.tweet_count, TweetCountLogA.buzz FROM tweet_count_log AS TweetCountLogA INNER JOIN (SELECT product_id, MAX(created_at) AS latest_date FROM tweet_count_log WHERE product_id = :productId GROUP BY DATE(created_at)) AS TweetCountLogB ON TweetCountLogA.product_id = TweetCountLogB.product_id AND TweetCountLogA.created_at = TweetCountLogB.latest_date ORDER BY created_at ASC",
    {
      replacements: {
        productId: productId,
      },
      type: Sequelize.QueryTypes.SELECT,
    }
  ));

  var rowDateLabels, buzzChartData, tweetCountChartData;
  if (buzzPerDayRows.length) {
    var startMoment = new Moment(buzzPerDayRows[0].date);
    var endMoment = new Moment(buzzPerDayRows[buzzPerDayRows.length - 1].date);
    var diffDayNum = Moment.duration(endMoment - startMoment).days();
    var dates = [...Array(diffDayNum + 1).keys()].map(v => startMoment.clone().add(v, 'days'));

    rowDateLabels = __.map(dates, date => {
      return date.format("YYYY-MM-DD");
    });

    // buzz (line chart)
    var dateStrIntoBuzzRow = __.indexBy(buzzPerDayRows, row => {
      return row.date;
    });
    buzzChartData = __.map(rowDateLabels, rowLabelStr => {
      return dateStrIntoBuzzRow[rowLabelStr] ? dateStrIntoBuzzRow[rowLabelStr].buzz : null;
    });

    // tweet count (bar chart)
    var dateStrIntoTweetCountRow = __.indexBy(tweetCountPerDayRows, row => {
      return row.date;
    });
    tweetCountChartData = __.map(rowDateLabels, rowLabelStr => {
      return dateStrIntoTweetCountRow[rowLabelStr] ? dateStrIntoTweetCountRow[rowLabelStr].count : null;
    });
  }

  var result = {
    xLabels: rowDateLabels,
    buzzChartData: buzzChartData,
    tweetCountChartData: tweetCountChartData,
  };

  var stringifiedResult = JSON.stringify(result);

  redis.set(cacheKey, stringifiedResult, "EX", (60 * 60) * 12); // 12 hours cache

  return res.send(stringifiedResult);
});

router.get('/product/tweet_list', async function (req, res, next) {
  var q = req.query;
  var productId = Number(q.productId);
  var cacheKey = cacheUtil.generateTweetDataListForProductDetailPageCacheKey(productId);
  var cache = await redis.get(cacheKey);
  if (cache) {
    res.send(cache);
    return;
  }

  console.log("cache miss: " + cacheKey);

  var productModel = (await Util.selectProductModels({
    productId: productId,
  }))[0];

  var [tweetModels, blockTwitterUserModels] = await Promise.all([
    NewTweet.findAll({
      where: {
        productId: productId,
      },
      order: [
        ['tweetedAt', 'DESC']
      ],
      limit: 500,
    }),
    BlockTwitterUser.findAll(),
  ]);

  var screenNameToBlockTwitterUserModelHash = __.indexBy(blockTwitterUserModels, m => {
    return m.screenName;
  });

  var modifiedTweetModels = await Util.sortAndFilterTweetModels(tweetModels, {
    limitNumAfterModify: 250,
    prioritizeFirstAppearUserTweet: true,
    deprioritizeBlockedUser: true,
    deprioritizeContainsSpecificWordsInText: true,
    screenNameToBlockTwitterUserModelHash: screenNameToBlockTwitterUserModelHash,
    productModel: productModel,
    prioritizeContainProductNameInText: true,
    deprioritizeByNewLineCharCount: 9,
  });

  var tweetDataListForProductDetailPage = __.map(modifiedTweetModels, m => {
    return [m.screenName, m.id, m.text];
  });

  var serializedTweetDataListForProductDetailPage = JSON.stringify(tweetDataListForProductDetailPage);
  redis.set(cacheKey, serializedTweetDataListForProductDetailPage, "EX", (60 * 60) * 6); // 6 hours cache

  res.send(serializedTweetDataListForProductDetailPage);
});

module.exports = router;
