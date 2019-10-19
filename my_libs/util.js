const appRoot = require('app-root-path');
const Q = require('q');
const WebService = require(appRoot + '/models/web_service');
const Book = require(appRoot + '/models/book');
const Game = require(appRoot + '/models/game');
const __ = require('underscore');
const memoryCache = require('memory-cache');
const sequelize = require(appRoot + '/db/sequelize_config');
const FastLevenShtein = require('fast-levenshtein');
const Moment = require('moment');
const CONST = require(appRoot + '/my_libs/const.js');

const Stat = require(appRoot + '/models/stat.js');
const StatData = require(appRoot + '/models/stat_data.js');
const InvalidProduct = require(appRoot + '/models/invalid_product.js');
const Tweet = require(appRoot + '/models/tweet');
const BlockTwitterUser = require(appRoot + '/models/block_twitter_user');
const BookCaption = require(appRoot + '/models/book_caption.js');

function convertJapaneseDateStrIntoMysqlDate(japaneseDateStr) {
  var after = japaneseDateStr.replace('年', '-').replace('月', '-').replace('日', '');
  var pattern = /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/g;

  return after.match(pattern) ? after : '9999-12-31';
};

// XXXX年XX月XX日　XX:XX
function convertDateObjectIntoJapaneseDateString(date) {
  return sprintf(
    '%s年%s月%s日',
    date.getFullYear(), date.getMonth() + 1, date.getDate()
  );
};

function convertDateObjectIntoMySqlReadableString(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1
  const d = date.getDate();
  const hour = date.getHours();
  const min = date.getMinutes();
  const sec = date.getSeconds();

  return y + '-' + m + '-' + d + ' ' + hour + ':' + min + ':' + sec;
}

function generateStatRangeJapaneseString(baseDate) {
  var tempDate = new Date(baseDate);
  var oneWeekAgo = new Date(tempDate.setDate(tempDate.getDate() - 7));

  return sprintf(
    '%s ~ %s',
    convertDateObjectIntoJapaneseDateString(oneWeekAgo),
    convertDateObjectIntoJapaneseDateString(baseDate)
  );
};

function isAdminByReq(req) {
  var email = req.user ? req.user.email : null;
  return email == Config.admin_gmail_address;
}

// middle wares
function htmlCache(cacheDurationSec) {
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

function selectProductModelsByProductIds(productIds) {
  var d = Q.defer();

  Q.allSettled(
    __.map(CONST.PRODUCT_MODELS, Model => {
      return Model.selectByProductIds(productIds);
    })
  ).then(function (results) {
    var productModels = __.chain(results)
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

async function selectProductModelsByProductTypeIds(productTypeIds) {
  var productModels = __.flatten(
    await Promise.all(
      __.map(CONST.PRODUCT_MODELS, Model => {
        return Model.selectByProductTypeIds(productTypeIds);
      })
    )
  );

  return productModels;
}

async function buildRanking(targetProductTypeIds, targetDateMoment) {
  var isTargetProductTypeHash = __.indexBy(targetProductTypeIds, productTypeId => {
    return productTypeId;
  });

  var [statModel, ranking] = await buildRankingByDateMoment(targetDateMoment);
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

function getRankingCacheKeyByMoment(moment) {
  return 'ranking_' + moment.format();
}

function isCachedRanking(targetDateMoment) {
  var rankingCacheKey = getRankingCacheKeyByMoment(targetDateMoment);
  return !!memoryCache.get(rankingCacheKey);
}

async function buildRankingByDateMoment(targetDateMoment) {
  var rankingCacheKey = getRankingCacheKeyByMoment(targetDateMoment);
  var rankingCache = memoryCache.get(rankingCacheKey);
  if (rankingCache) {
    return rankingCache;
  }

  console.log("building ranking... " + targetDateMoment.format("YYYY-MM-DD"));
  var statModel = await Stat.selectByRankingDate(targetDateMoment);
  var statDataModels = await StatData.selectByStatId(statModel.id);
  var invalidProductModelsHash = __.indexBy(await InvalidProduct.findAll(), m => {
    return m.productId;
  });
  var sortedRankingDataModels = (() => {
    return __.chain(statDataModels)
      .sortBy(m => {
        return -1 * m.buzz; // desc
      })
      .filter(m => {
        return !invalidProductModelsHash[m.productId];
      })
      .value();
  })();
  var productIds = __.map(sortedRankingDataModels, function (m) {
    return m.productId;
  });

  console.log('select tweet model');
  console.log('since: ' + statModel.statSince);
  console.log('until: ' + statModel.statUntil);

  var [productModels, tweetModels, bookCaptionModels, blockTwitterUserModels] = await Promise.all([
    selectProductModelsByProductIds(productIds),

    // TODO: this takes more than 10secs
    Tweet.selectByProductIds(productIds, {
      // excludeRetweet: true,
      excludeInvalidTweets: true,
      since: statModel.statSince,
      until: statModel.statUntil,
    }),

    BookCaption.selectByProductIds(productIds),
    BlockTwitterUser.findAll(),
  ]);

  console.log(tweetModels.length + ' tweets found');

  var productIdToProductModelHash = __.indexBy(productModels, m => {
    return m.productId;
  });

  var productIdToTweetModelsHash = __.groupBy(tweetModels, m => {
    return m.productId;
  });

  var productIdToBookCaptionModelHash = __.indexBy(bookCaptionModels, m => {
    return m.productId;
  });

  var screenNameToBlockTwitterUserModelHash = __.indexBy(blockTwitterUserModels, m => {
    return m.screenName;
  });

  console.log('building tweet data array...');

  var productIdToTweetDataArray = {};
  var productIds = __.keys(productIdToTweetModelsHash);
  for (var i = 0; i < productIds.length; i++) {
    var productId = productIds[i];
    var tweetModels = productIdToTweetModelsHash[productId];
    var tweetDataArray = buildTweetDataArray(tweetModels, {
      excludeUnnecessaryDataForDisplay: true,
      prioritizeFirstAppearUserTweet: true,
      deprioritizeBlockedUser: true,
      screenNameToBlockTwitterUserModelHash: screenNameToBlockTwitterUserModelHash,
      deprioritizeContainsSpecificWordsInText: true,
    });

    // NOTE: this loop is way too heavy and blocking process for long time so put sleep to open calc resource
    await sleep(20);

    productIdToTweetDataArray[productId] = tweetDataArray;
  }

  console.log('building tweet data array process finished');
  console.log('building final ranking object...');

  var ranking = __.chain(sortedRankingDataModels)
    .map(statDataModel => {
      var productId = statDataModel.productId;
      var productModel = productIdToProductModelHash[productId];
      var tweetDataArray = __.first(productIdToTweetDataArray[productId], 100);
      var bookCaptionModel = productIdToBookCaptionModelHash[productId];

      return {
        productModel: productModel,
        statDataModel: statDataModel,
        tweetDataArray: tweetDataArray,
        bookCaptionModel: bookCaptionModel,
      };
    })
    .value();

  var result = [statModel, ranking];

  memoryCache.put(rankingCacheKey, result);

  return result;
}

async function getProductIdToIsNewProductHash(statId) {
  let statDataModels = (await sequelize.query(
    sprintf(
      "SELECT * FROM stat_data WHERE product_id IN (SELECT product_id FROM (SELECT product_id, count(*) AS count FROM stat_data WHERE is_invalid = 0 GROUP BY product_id) AS hoge WHERE hoge.count = 1) AND stat_id = %d;",
      statId
    )
  ))[0];

  var productIdToIsNewProductHash = {};
  __.each(statDataModels, statDataModel => {
    productIdToIsNewProductHash[statDataModel.product_id] = true;
  });

  return productIdToIsNewProductHash;
}

function calcNormalizedLevenshteinDistance(strA, strB) {
  if (!strA || !strB) return 1.0;

  var maxStrLength = Math.max(strA.length, strB.length);
  var distance = FastLevenShtein.get(strA, strB);

  return distance / maxStrLength;
}

function buildTweetDataArray(tweetModels, options) {
  options = options || {};

  var tweetDataArray = __.map(tweetModels, m => {
    var text = m.text;

    var trimedText;
    trimedText = text.replace(/(https:\/\/t\.co\/[a-zA-Z0-9]+|https:\/\/t\.…|…)/g, '');
    trimedText = trimedText.slice(0, Const.STR_LENGTH_FOR_CALC_LSD);

    return {
      tweetModel: m,
      trimedText: trimedText,
      similarTweetData: undefined,
      parentTweetData: undefined,
    };
  });

  // detect practically same tweets
  var tweetIdToParentTweetDataHash = {};
  __.each(tweetDataArray, tweetData => {
    var tweetModel = tweetData.tweetModel;
    var tweetId = tweetModel.retweetTargetId || tweetModel.tweetId;
    var parentTweetData = tweetIdToParentTweetDataHash[tweetId];

    if (!parentTweetData) {
      tweetIdToParentTweetDataHash[tweetId] = tweetData;
      return;
    }

    tweetData.parentTweetData = parentTweetData;
  });

  // this should be done before detecting similar tweet process which so high calc complexity
  if (options.excludeUnnecessaryDataForDisplay) {
    tweetDataArray = __.filter(tweetDataArray, data => {
      return !data.parentTweetData;
    });
  }

  // detect similar tweets
  // NOTE: too high calc complexity O(n^2). need fix
  __.each(tweetDataArray, baseTweetData => {
    baseTweetData.tweetIdToNLSDHash = baseTweetData.tweetIdToNLSDHash || {};
    if (baseTweetData.similarTweetData) return;

    __.each(tweetDataArray, compareTweetData => {
      if (baseTweetData.tweetModel.tweetId == compareTweetData.tweetModel.tweetId) return;
      if (baseTweetData.tweetIdToNLSDHash[compareTweetData.tweetModel.tweetId]) return;

      var NLSD = calcNormalizedLevenshteinDistance(baseTweetData.trimedText, compareTweetData.trimedText);

      compareTweetData.tweetIdToNLSDHash = compareTweetData.tweetIdToNLSDHash || {};
      compareTweetData.tweetIdToNLSDHash[baseTweetData.tweetModel.tweetId] = NLSD;

      if (NLSD < 0.5) {
        compareTweetData.similarTweetData = baseTweetData;
      }
    });
  });

  // sorting
  tweetDataArray = tweetDataArray.sort(function (a, b) {
    var tweetModelA = a.tweetModel;
    var tweetModelB = b.tweetModel;

    // RT
    // if (tweetModelA.retweetTargetId && !tweetModelB.retweetTargetId) return 1;
    // if (!tweetModelA.retweetTargetId && tweetModelB.retweetTargetId) return -1;

    // favourited count
    return tweetModelB.favouriteCount - tweetModelA.favouriteCount;
  });

  if (options.excludeUnnecessaryDataForDisplay) {
    tweetDataArray = __.filter(tweetDataArray, data => {
      return !data.parentTweetData && !data.similarTweetData;
    });
  }

  if (options.prioritizeFirstAppearUserTweet) {
    var isAlreadyAppearedHash = {};
    var firstAppeared = [];
    var alreadyAppeared = [];

    __.each(tweetDataArray, tweetData => {
      var userId = tweetData.tweetModel.userId;

      if (!isAlreadyAppearedHash[userId]) {
        isAlreadyAppearedHash[userId] = true;
        firstAppeared.push(tweetData);
      } else {
        alreadyAppeared.push(tweetData);
      }
    });

    tweetDataArray = __.flatten([firstAppeared, alreadyAppeared]);
  }

  if (options.deprioritizeBlockedUser) {
    if (!options.screenNameToBlockTwitterUserModelHash) {
      throw new Error('need screenNameToBlockTwitterUserModelHash to use deprioritizeBlockedUser option');
    }

    var isExcluded = function (tweetModel) {
      if (options.screenNameToBlockTwitterUserModelHash[tweetModel.screenName]) return true;

      var matchResult = tweetModel.text.match(/RT @([a-zA-Z0-9_]+): /);
      if (matchResult && options.screenNameToBlockTwitterUserModelHash[matchResult[1]]) {
        return true;
      }

      return false;
    };

    var blockedTweetDataArray = [];
    var nonBlockedTweetDataArray = [];
    __.each(tweetDataArray, tweetData => {
      if (isExcluded(tweetData.tweetModel)) {
        blockedTweetDataArray.push(tweetData);
      } else {
        nonBlockedTweetDataArray.push(tweetData);
      }
    });

    tweetDataArray = __.flatten([nonBlockedTweetDataArray, blockedTweetDataArray]);
  }

  if (options.deprioritizeContainsSpecificWordsInText) {
    var blockedTweetDataArray = [];
    var nonBlockedTweetDataArray = [];
    __.each(tweetDataArray, tweetData => {
      var isNonBlocked = __.every(Const.DEPRIORITIZE_WORDS_IN_TWEET_TEXT, word => {
        return tweetData.tweetModel.text.indexOf(word) == -1 ? true : false;
      });

      if (isNonBlocked) {
        nonBlockedTweetDataArray.push(tweetData);
      } else {
        blockedTweetDataArray.push(tweetData);
      }
    });

    tweetDataArray = __.flatten([nonBlockedTweetDataArray, blockedTweetDataArray]);
  }

  return tweetDataArray;
}

module.exports = {
  convertJapaneseDateStrIntoMysqlDate: convertJapaneseDateStrIntoMysqlDate,
  convertDateObjectIntoJapaneseDateString: convertDateObjectIntoJapaneseDateString,
  convertDateObjectIntoMySqlReadableString: convertDateObjectIntoMySqlReadableString,
  generateStatRangeJapaneseString: generateStatRangeJapaneseString,
  isAdminByReq: isAdminByReq,
  htmlCache: htmlCache,
  selectProductModelsByProductIds: selectProductModelsByProductIds,
  selectProductModelsByProductTypeIds: selectProductModelsByProductTypeIds,
  buildRanking: buildRanking,
  buildRankingByDateMoment: buildRankingByDateMoment,
  getProductIdToIsNewProductHash: getProductIdToIsNewProductHash,
  calcNormalizedLevenshtein: calcNormalizedLevenshteinDistance,
  buildTweetDataArray: buildTweetDataArray,
  isCachedRanking: isCachedRanking,
};
