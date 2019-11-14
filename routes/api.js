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
const ProductNum = require(appRoot + '/models/product_num');
const SimpleStat = require('simple-statistics');

function isAdmin(req, res, next) {
  var email = req.user ? req.user.email : null;

  if (email == Config.admin_gmail_address) {
    return next();
  }
  else {
    res.redirect('/auth');
  }
}

router.get('/product/buzz_stat', async function (req, res, next) {
  var q = req.query;
  var productId = Number(q.productId);
  var cacheKey = cacheUtil.generateChartDataCacheKey(productId);
  var cache = await redis.get(cacheKey);

  if (cache) {
    res.send(cache);
    return;
  }

  console.log("cache miss: " + cacheKey);

  let [productModel, tweetCountPerDayRows, buzzPerDayRows, statDataRows] = await Promise.all([
    Util.selectProductModels({
      productId: productId,
    }),
    // count tweet num per day
    sequelize.query(
      "SELECT DATE(tweeted_at) AS date, COUNT(*) AS count FROM new_tweet WHERE product_id = :productId GROUP BY DATE(tweeted_at) ORDER BY date ASC",
      {
        replacements: {
          productId: productId,
        },
        type: Sequelize.QueryTypes.SELECT,
      }
    ),
    // get latest TweetCountLog row per product
    sequelize.query(
      "SELECT DATE(TweetCountLogA.created_at) AS date, TweetCountLogA.tweet_count, TweetCountLogA.buzz FROM tweet_count_log AS TweetCountLogA INNER JOIN (SELECT product_id, MAX(created_at) AS latest_date FROM tweet_count_log WHERE product_id = :productId GROUP BY DATE(created_at)) AS TweetCountLogB ON TweetCountLogA.product_id = TweetCountLogB.product_id AND TweetCountLogA.created_at = TweetCountLogB.latest_date ORDER BY created_at ASC",
      {
        replacements: {
          productId: productId,
        },
        type: Sequelize.QueryTypes.SELECT,
      }
    ),
    // get stat data records about this product
    sequelize.query(
      "SELECT * FROM stat_data JOIN stat ON stat.id = stat_data.stat_id WHERE product_id = :productId",
      {
        replacements: {
          productId: productId,
        },
        type: Sequelize.QueryTypes.SELECT,
      }
    ),
  ]);

  productModel = productModel[0];

  var dateIntoStatDataRow = __.indexBy(statDataRows, row => {
    return row.ranking_date;
  });

  // format buzz chart data
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
      var buzzByRanking = dateIntoStatDataRow[rowLabelStr] ? dateIntoStatDataRow[rowLabelStr].buzz : null;
      var buzzByTweetCountLog = dateStrIntoBuzzRow[rowLabelStr] ? dateStrIntoBuzzRow[rowLabelStr].buzz : null;
      return buzzByRanking || buzzByTweetCountLog;
    });

    // tweet count (bar chart)
    var dateStrIntoTweetCountRow = __.indexBy(tweetCountPerDayRows, row => {
      return row.date;
    });
    tweetCountChartData = __.map(rowDateLabels, rowLabelStr => {
      return dateStrIntoTweetCountRow[rowLabelStr] ? dateStrIntoTweetCountRow[rowLabelStr].count : null;
    });
  }

  // format rank history data
  var sortedDateStrListForStatData = __.sortBy(__.keys(dateIntoStatDataRow), dateStr => {
    return new Moment(dateStr).unix();
  });

  var productNumModels = await ProductNum.selectByDateListAndProductTypeId(sortedDateStrListForStatData, productModel.productTypeId);
  var dateIntoProductNumModel = __.indexBy(productNumModels, m => {
    return m.date;
  });

  var rankHistoryData = (() => {
    var histDataArray = __.chain(sortedDateStrListForStatData)
      .map(dateStr => {
        var statDataRow = dateIntoStatDataRow[dateStr];
        var productNumModel = dateIntoProductNumModel[dateStr] || {};
        return {
          date: dateStr,
          allRank: statDataRow.rank,
          categoryRank: statDataRow.category_rank,
          categoryProductCount: productNumModel.count,
          buzz: statDataRow.buzz,
        };
      })
      .filter(histData => {
        return histData.allRank;
      })
      .value();

    var latestHistData = __.max(histDataArray, rankHistData => {
      return new Moment(rankHistData.date).unix();
    });
    var allPeakHistData = __.max(histDataArray, rankHistData => {
      return rankHistData.allRank;
    });
    var categoryPeakHistData = __.max(histDataArray, rankHistData => {
      return rankHistData.buzz;
    });

    return {
      latest: latestHistData,
      peak: {
        all: allPeakHistData,
        category: categoryPeakHistData,
      },
    };
  })();

  var result = {
    xLabels: rowDateLabels,
    buzzChartData: buzzChartData,
    tweetCountChartData: tweetCountChartData,
    rankHistoryData: rankHistoryData,
    checkPointTexts: [],
  };

  var checkPointTexts = 1 < result.xLabels.length ? generateChartCheckPointTexts(result, productModel) : ['現在この商品に関する情報を収集中です。'];
  result.checkPointTexts = checkPointTexts;

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

function generateChartCheckPointTexts(buzzStat, productModel) {
  var checkPointTexts = [];
  var productTypeBundleId = Const.PRODUCT_TYPE_ID_TO_BELONGED_PRODUCT_TYPE_BUNDLE_ID[productModel.productTypeId];
  var productTypeBundleNameJA = Const.PRODUCT_TYPE_BUNDLE_ID_TO_JA_NAME_HASH[productTypeBundleId];
  var recentWeekTweetCounts = __.initial(__.last(buzzStat.tweetCountChartData, 8));

  // about avg tweet num
  var averageTweetCountThisWeek = Math.floor(__.reduce(recentWeekTweetCounts, (memo, n) => {
    return memo + n;
  }) / recentWeekTweetCounts.length);
  checkPointTexts.push((() => {
      var baseText = '最近1週間で、1日平均' + averageTweetCountThisWeek + '人のユーザーにツイートされています。';
      if (10000 <= averageTweetCountThisWeek) {
        return baseText + '未曾有クラスのバズリ方をしています。もはや日本人なら知らない人はいない？！';
      } else if (5000 <= averageTweetCountThisWeek) {
        return baseText + productTypeBundleNameJA + 'を愛する人なら誰もが知っている勢いでバズっています。';
      } else if (3000 <= averageTweetCountThisWeek) {
        return baseText + '非常に注目されている水準に達しています。';
      } else if (500 <= averageTweetCountThisWeek) {
        return baseText + '比較的注目されている水準に達しています。';
      } else if (100 <= averageTweetCountThisWeek) {
        return baseText + '現時点では知る人ぞ知るレベルでは注目されています。';
      } else if (30 <= averageTweetCountThisWeek) {
        return baseText + '現時点ではあまり話題にはなっていないようです。';
      } else {
        return baseText + '現時点ではその存在すらほぼ知られていないようです。';
      }
    }
  )());

  // about tweet num tendency
  var inputDataForCalcLinearRegression = __.times(recentWeekTweetCounts.length, n => {
    var num = recentWeekTweetCounts[n];
    return [n, num];
  });

  var linearRegResult = SimpleStat.linearRegression(inputDataForCalcLinearRegression);
  var slope = linearRegResult.m;
  var growthPercentage = Math.floor((slope / averageTweetCountThisWeek) * 100);
  checkPointTexts.push((() => {
    var baseText = '最近1週間のツイート数の上昇率は' + growthPercentage + '%です。';

    if (1000 <= growthPercentage) {
      return baseText + '未曾有クラスの急激な増加傾向にあり、最近この商品に関連した特大の出来事があった可能性が高いでしょう。';
    } else if (200 <= growthPercentage) {
      return baseText + '急激なペースの増加傾向にあり、最近この商品に関連した大きな出来事があった可能性が高いでしょう。';
    } else if (80 <= growthPercentage) {
      return baseText + '非常に早いペースでの増加傾向にあり、最近この商品に関連した何かしらの出来事があった可能性が高いでしょう。';
    } else if (30 <= growthPercentage) {
      return baseText + '早いペースでの増加傾向にあり、最近この商品に関連した何かしらの出来事があった可能性があります。';
    } else if (10 <= growthPercentage) {
      return baseText + 'ゆるやかな増加傾向にあり、今後さらに注目される可能性があります。';
    } else if (-10 <= growthPercentage) {
      return baseText + 'ほぼ横ばいで、今後近い内に注目をさらに集めるか落ち着いていくかはこの商品の展開次第でしょう。';
    } else if (-30 <= growthPercentage) {
      return baseText + 'ゆるやかな減少傾向にあり、今後注目度は落ち着いていく可能性が高いでしょう。';
    } else if (-80 <= growthPercentage) {
      return baseText + '早いペースでの減少傾向にあり、この商品に対する興味が失われ始めている可能性が高いでしょう。';
    } else if (-200 <= growthPercentage) {
      return baseText + '非常に早いペースでの減少傾向にあり、この商品に対する興味が失われ始めています。';
    } else if (-1000 <= growthPercentage) {
      return baseText + '急激なペースでの減少傾向にあり、大多数の人にとってこの商品に対する興味は単なる一時のものであった可能性が高いでしょう。';
    } else {
      return baseText + '未曾有クラスの急激な減少傾向にあり、単なる一発屋だったとも言わざるを得ないでしょう・・。';
    }
  })());

  // about ranking history
  checkPointTexts.push((() => {
    var latestIdx = buzzStat.xLabels.length - 1;
    var peakIdx = (() => {
      var memo = -1;
      var idx = 0;
      for (var i = 0; i < buzzStat.buzzChartData.length; i++) {
        var buzz = buzzStat.buzzChartData[i];
        if (memo <= buzz) {
          idx = i;
          memo = buzz;
        }
      }
      return idx;
    })();

    var latestDate = buzzStat.xLabels[latestIdx];
    var peakDate = buzzStat.xLabels[peakIdx];
    var latestBuzz = buzzStat.buzzChartData[latestIdx];
    var peakBuzz = buzzStat.buzzChartData[peakIdx];

    if (latestDate == peakDate) return '現在この商品のBuzz最高記録を更新中です！今後の動向に注目しましょう。';

    var buzzGrowthPercentage = Math.floor((latestBuzz / peakBuzz) * 100);

    if (85 <= buzzGrowthPercentage) {
      return sprintf(
        '%sに注目度のピーク%dBuzzを達成しましたが、現在もほぼ同等の%dBuzzを維持しています。',
        new Moment(peakDate).format('YYYY年MM月DD日'),
        peakBuzz,
        latestBuzz
      );

    } else {
      return sprintf(
        '%sに注目度のピーク%dBuzzを達成後、現在は%dBuzzに落ち着いています。',
        new Moment(peakDate).format('YYYY年MM月DD日'),
        peakBuzz,
        latestBuzz
      );
    }

  })());

  return checkPointTexts;
}

