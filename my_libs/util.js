const appRoot = require('app-root-path');
const Q = require('q');
const A8ProgramModel = require(appRoot + '/models/a8_program.js');
const WebService = require(appRoot + '/models/web_service');
const Book = require(appRoot + '/models/book');
const Game = require(appRoot + '/models/game');
const _ = require('underscore');
const memoryCache = require('memory-cache');
const sequelize = require(appRoot + '/db/sequelize_config');

const Stat = require(appRoot + '/models/stat.js');
const StatData = require(appRoot + '/models/stat_data.js');
const InvalidProduct = require(appRoot + '/models/invalid_product.js');
const Tweet = require(appRoot + '/models/tweet');
const BlockTwitterUser = require(appRoot + '/models/block_twitter_user');
const BookCaption = require(appRoot + '/models/book_caption.js');

exports.convertJapaneseDateStrIntoMysqlDate = function (japaneseDateStr) {
  var after = japaneseDateStr.replace('年', '-').replace('月', '-').replace('日', '');
  var pattern = /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/g;

  return after.match(pattern) ? after : '9999-12-31';
};

// XXXX年XX月XX日　XX:XX
exports.convertDateObjectIntoJapaneseDateString = function (date) {
  return sprintf(
    '%s年%s月%s日',
    date.getFullYear(), date.getMonth() + 1, date.getDate()
  );
};

exports.convertDateObjectIntoMySqlReadableString = function (date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1
  const d = date.getDate();
  const hour = date.getHours();
  const min = date.getMinutes();
  const sec = date.getSeconds();

  return y + '-' + m + '-' + d + ' ' + hour + ':' + min + ':' + sec;
}

exports.generateStatRangeJapaneseString = function (baseDate) {
  var tempDate = new Date(baseDate);
  var oneWeekAgo = new Date(tempDate.setDate(tempDate.getDate() - 7));

  return sprintf(
    '%s ~ %s',
    this.convertDateObjectIntoJapaneseDateString(oneWeekAgo),
    this.convertDateObjectIntoJapaneseDateString(baseDate)
  );
};

exports.isAdminByReq = function (req) {
  var email = req.user ? req.user.email : null;
  return email == Config.admin_gmail_address;
}

// middle wares
exports.htmlCache = function (cacheDurationSec) {
  return (req, res, next) => {
    let key = '__express__' + req.originalUrl || req.url
    let cachedBody = mcache.get(key)
    if (cachedBody) {
      res.send(cachedBody)
      return
    } else {
      res.sendResponse = res.send
      res.send = (body) => {
        mcache.put(key, body, duration * 1000);
        res.sendResponse(body)
      }
      next()
    }
  };
}

exports.selectProductModelsByProductIds = function (productIds) {
  var d = Q.defer();

  Q.allSettled([
    A8ProgramModel.selectByProductIds(productIds),
    Book.selectByProductIds(productIds),
    Game.selectByProductIds(productIds),
    WebService.selectByProductIds(productIds),
  ]).then(function (results) {
    var productModels = _.chain(results)
      .map(r => {
        return r.value;
      })
      .flatten()
      .compact()
      .value();

    d.resolve(productModels);
  });

  return d.promise;
}

exports.sortAndExcludeTweetsForListingTweets = async function (tweetModels) {
  var blockTwitterUserModels = await BlockTwitterUser.findAll();
  var blockTwitterUserHash = _.indexBy(blockTwitterUserModels, m => {
    return m.screenName;
  });

  // exclude same tweets
  var excludedTweetModels = _.uniq(tweetModels, m => {
    return m.retweetTargetId || m.tweetId;
  });

  var isExcluded = function (tweet) {
    if (blockTwitterUserHash[tweet.screenName]) return true;
    return false;
  };

  return excludedTweetModels.sort(function (a, b) {
    // excluded tweet
    if (isExcluded(a) && !isExcluded(b)) return 1;
    if (!isExcluded(a) && isExcluded(b)) return -1;

    // RT
    // if (a.retweetTargetId && !b.retweetTargetId) return 1;
    // if (!a.retweetTargetId && b.retweetTargetId) return -1;

    // favourited count
    return b.favouriteCount - a.favouriteCount;
  });
}

exports.buildRanking = async function (targetProductTypeIds, targetDateMoment) {
  var isTargetProductTypeHash = __.indexBy(targetProductTypeIds, productTypeId => {
    return productTypeId;
  });

  var [statModel, ranking] = await this.buildRankingByDateMoment(targetDateMoment);
  var filteredRanking = __.filter(ranking, data => {
    return !!isTargetProductTypeHash[data.productModel.productTypeId];
  });

  var rank = 0;
  var previousUserCount = null;
  __.each(filteredRanking, data => {
    var userCount = data.statDataModel.userCount;
    if (previousUserCount != userCount) {
      rank++;
      previousUserCount = rank;
    }
    data.rank = rank;
  });

  return [statModel, filteredRanking];
}

function sortTweet(tweets, excludeScreenNameHash) {
  var isExcluded = function (tweet) {
    if (excludeScreenNameHash[tweet.screenName]) return true;
    return false;
  };

  return tweets.sort(function (a, b) {
    // excluded tweet
    if (isExcluded(a) && !isExcluded(b)) return 1;
    if (!isExcluded(a) && isExcluded(b)) return -1;

    // RT
    if (a.retweetTargetId && !b.retweetTargetId) return 1;
    if (!a.retweetTargetId && b.retweetTargetId) return -1;

    // favourited count
    return b.favouriteCount - a.favouriteCount;
  });
}

exports.buildRankingByDateMoment = async function (targetDateMoment) {
  var rankingCacheKey = 'ranking_' + targetDateMoment.format();
  var rankingCache = memoryCache.get(rankingCacheKey);
  if (rankingCache) {
    return rankingCache;
  }

  var statModel = await Stat.selectByRankingDate(targetDateMoment);
  var statDataModels = await StatData.selectByStatId(statModel.id);
  var invalidProductModelsHash = __.indexBy(await InvalidProduct.findAll(), m => {
    return m.productId;
  });
  var sortedRankingDataModels = (() => {
    return __.chain(statDataModels)
      .sortBy(m => {
        return -1 * m.userCount; // desc
      })
      .filter(m => {
        return !invalidProductModelsHash[m.productId];
      })
      .value();
  })();
  var productIds = __.map(sortedRankingDataModels, function (m) {
    return m.productId;
  });

  var [productModels, tweetModels, bookCaptionModels, blockTwitterUserModels] = await Promise.all([
    exports.selectProductModelsByProductIds(productIds),
    Tweet.selectByProductIds(productIds, {
      // excludeRetweet: true,
      excludeInvalidTweets: true,
      since: statModel.since,
      until: statModel.until,
    }),
    BookCaption.selectByProductIds(productIds),
    BlockTwitterUser.findAll(),
  ]);

  var productIdToProductModelHash = __.indexBy(productModels, m => {
    return m.productId;
  });

  var productIdToTweetsHash = __.groupBy(tweetModels, m => {
    return m.productId;
  });

  var productIdToBookCaptionModelHash = __.indexBy(bookCaptionModels, m => {
    return m.productId;
  });

  var screenNameToBlockTwitterUserModelHash = __.indexBy(blockTwitterUserModels, m => {
    return m.screenName;
  });

  // sort and remove duplicated tweets
  __.each(productIdToTweetsHash, function (tweets, productId) {
    var sortedTweets = sortTweet(tweets, screenNameToBlockTwitterUserModelHash);

    // exclude duplicate tweets
    var distinctTweets = [];
    var alreadyHasHash = {};
    __.each(sortedTweets, tweetModel => {
      var tweetId = tweetModel.retweetTargetId || tweetModel.tweetId;
      if (alreadyHasHash[tweetId]) {
        return;
      }

      alreadyHasHash[tweetId] = true;
      distinctTweets.push(tweetModel);
    });

    productIdToTweetsHash[productId] = distinctTweets;
  });

  var ranking = __.chain(sortedRankingDataModels)
    .map(statDataModel => {
      var productId = statDataModel.productId;
      var productModel = productIdToProductModelHash[productId];
      var tweetModels = __.first(productIdToTweetsHash[productId], 100);
      var bookCaptionModel = productIdToBookCaptionModelHash[productId];

      return {
        productModel: productModel,
        statDataModel: statDataModel,
        tweetModels: tweetModels,
        bookCaptionModel: bookCaptionModel,
      };
    })
    .value();

  var result = [statModel, ranking];

  memoryCache.put(rankingCacheKey, result);

  return result;
}

exports.getProductIdToIsNewProductHash = async function (statId) {
  let statDataModels = (await sequelize.query(
    sprintf(
      "SELECT * FROM stat_data WHERE product_id IN (SELECT product_id FROM (SELECT product_id, count(*) AS count FROM stat_data WHERE is_invalid = 0 GROUP BY product_id) AS hoge WHERE hoge.count = 1) AND stat_id = %d;",
      statId
    )
  ))[0];

  var productIdToIsNewProductHash = {};
  _.each(statDataModels, statDataModel => {
    productIdToIsNewProductHash[statDataModel.product_id] = true;
  });

  return productIdToIsNewProductHash;
}
