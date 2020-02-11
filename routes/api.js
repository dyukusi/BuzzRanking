const appRoot = require('app-root-path');
const express = require('express');
const router = express.Router();
const __ = require('underscore');
const CONST = require(appRoot + '/lib/const.js');
const CacheKeyGenerator = require(appRoot + '/lib/cache_key_generator.js');
const CacheUtil = require(appRoot + '/lib/cache_util.js');
const simpleBuzzChartGenerator = require(appRoot + '/lib/simple_buzz_chart_generator.js');
const buzzStatGenerator = require(appRoot + '/lib/buzz_stat_generator.js');
const ProductUtil = require(appRoot + '/lib/product_util.js');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');
const sprintf = require('sprintf-js').sprintf;
const Util = require(appRoot + '/lib/util.js');

const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');

router.get('/all_search', async function (req, res, next) {
  var q = req.query;
  var searchString = q.searchString || '';

  if (__.isEmpty(searchString) || searchString.length <= 1) {
    return res.send(JSON.stringify({
      result: null,
    }));
  }

  var [searchProductBundleRows, searchProductRows] = await Promise.all([
    sequelize.query(
      "(SELECT id AS productBundleId, name AS label FROM product_bundle WHERE MATCH(name) AGAINST(:searchString) LIMIT 10) UNION ALL (SELECT product_bundle_id AS productBundleId, search_word AS name FROM twitter_alternative_search_word WHERE MATCH(search_word) AGAINST(:searchString) LIMIT 10)",
      {
        replacements: {
          searchString: searchString,
        },
        type: Sequelize.QueryTypes.SELECT,
      }
    ),

    (async () => {
      var results = await Promise.all(
        __.map(ProductUtil.getAllProductModelClass(), modelClass => {
          return sequelize.query(
            sprintf(
              "SELECT product_id AS productId, product_type_id AS productTypeId, product_bundle_id AS productBundleId, title AS label FROM %s WHERE MATCH(title) AGAINST(:searchString) LIMIT 10",
              modelClass.name
            ),
            {
              replacements: {
                searchString: searchString,
              },
              type: Sequelize.QueryTypes.SELECT,
            }
          );
        })
      );

      return __.flatten(results);
    })(),
  ]);

  searchProductBundleRows = __.sortBy(searchProductBundleRows, row => {
    return Util.calcNormalizedLevenshteinDistance(searchString, row.label)
  });

  __.each(searchProductBundleRows, row => {
    row.group = 'シリーズ';
  });

  __.each(searchProductRows, row => {
    var productTypeId = row.productTypeId;
    var bundleName = CONST.PRODUCT_TYPE_BUNDLE_ID_TO_JA_NAME_HASH[CONST.PRODUCT_TYPE_ID_TO_BELONGED_PRODUCT_TYPE_BUNDLE_ID[productTypeId]];
    row.group = bundleName;
  });

  var allRows = __.flatten([searchProductBundleRows, searchProductRows]);

  return res.send(JSON.stringify({
    result: allRows,
  }));
});

router.get('/search_twitter_account', async function (req, res, next) {
  var q = req.query;
  var searchString = q.searchString || '';

  if (__.isEmpty(searchString) || searchString.length <= 2) {
    return res.send(JSON.stringify({
      result: null,
    }));
  }

  var rows = await sequelize.query(
    "SELECT screen_name AS label FROM tweet WHERE screen_name LIKE :searchString GROUP BY screen_name LIMIT 30;",
    {
      replacements: {
        searchString: searchString + '%',
      },
      type: Sequelize.QueryTypes.SELECT,
    }
  );

  return res.send(JSON.stringify({
    result: rows,
  }));
});


router.get('/simple_buzz_chart', async function (req, res, next) {
  var q = req.query;
  var redis = CacheUtil.getRedisInstance();
  var productBundleIds = q.productBundleIds;
  var resultHash = {};

  if (__.isEmpty(productBundleIds)) {
    return res.send({});
  }

  for (var i = 0; i < productBundleIds.length; i++) {
    var productBundleId = productBundleIds[i];
    var simpleBuzzChartCacheKey = CacheKeyGenerator.generateSimpleBuzzChartImageCacheKeyByProductBundleId(productBundleId);
    var cachedSimpleBuzzChartImage = await redis.get(simpleBuzzChartCacheKey);

    if (cachedSimpleBuzzChartImage) {
      resultHash[productBundleId] = cachedSimpleBuzzChartImage;
      continue;
    }

    // var stringifiedBuzzStat = await buzzStatGenerator.getCachedStringifiedBuzzStatOrCreateIfNeed(productBundleId);
    // var buzzStat = JSON.parse(stringifiedBuzzStat);
    // var buzzChartData = buzzStat.buzzChartData;
    // var tweetCountChartData = buzzStat.tweetCountChartData;

    // NOTE: excluding today by getting range between -8 and -1
    // var latestOneWeekBuzzList = buzzChartData.slice(buzzChartData.length - 8, buzzChartData.length - 1);
    // var latestOneWeekTweetCountList = tweetCountChartData.slice(tweetCountChartData.length - 8, tweetCountChartData.length - 1);

    // for debug
    // var latestOneWeekBuzzList = buzzChartData.slice(buzzChartData.length - 7, buzzChartData.length - 0);
    // var latestOneWeekTweetCountList = tweetCountChartData.slice(tweetCountChartData.length - 7, tweetCountChartData.length - 0);

    console.log('simple buzz chart cache miss: ' + productBundleId);
    var base64Image = await
      simpleBuzzChartGenerator.createSimpleBuzzChartImage(productBundleId);

    resultHash[productBundleId] = base64Image;

    redis.set(simpleBuzzChartCacheKey, base64Image);
  }

  return res.send(JSON.stringify(resultHash));
});

router.get('/product/buzz_stat', async function (req, res, next) {
  var q = req.query;
  var productId = Number(q.productId);
  var stringifiedBuzzStat = await buzzStatGenerator.getCachedStringifiedBuzzStatOrCreateIfNeed(productId);
  return res.send(stringifiedBuzzStat);
});

router.post('/add_twitter_alt_search_word', async function (req, res, next) {
  var q = req.body;
  var isAdmin = Util.isAdminByReq(req);
  var productBundleId = q.productBundleId;
  var altSearchWord = q.altSearchWord;

  try {
    var createdTwitterAltSearchWordModel = await TwitterAlternativeSearchWord.create({
      productBundleId: productBundleId,
      searchWord: altSearchWord,
      validityStatus: isAdmin ? CONST.VALIDITY_STATUS_NAME_TO_ID_HASH.PROTECTED : CONST.VALIDITY_STATUS_NAME_TO_ID_HASH.UNDER_REVIEW,
    });
  } catch (e) {
    res.send({
      result: false,
    });
    return;
  }

  res.send({
    result: true,
  });
  return;
});

module.exports = router;


// router.get('/product/tweet_list', async function (req, res, next) {
//   var q = req.query;
//   var productId = Number(q.productId);
//   var cacheKey = CacheKeyGenerator.generateTweetDataListForProductDetailPageCacheKey(productId);
//   var cache = await redis.get(cacheKey);
//   if (cache) {
//     res.send(cache);
//     return;
//   }
//
//   console.log("cache miss: " + cacheKey);
//
//   var productModel = (await ProductUtil.selectProductModels({
//     productId: productId,
//   }))[0];
//
//   var [tweetModels, blockTwitterUserModels] = await Promise.all([
//     Tweet.findAll({
//       where: {
//         productId: productId,
//       },
//       order: [
//         ['tweetedAt', 'DESC']
//       ],
//       limit: 500,
//     }),
//     BlockTwitterUser.findAll(),
//   ]);
//
//   var screenNameToBlockTwitterUserModelHash = __.indexBy(blockTwitterUserModels, m => {
//     return m.screenName;
//   });
//
//   var modifiedTweetModels = await Util.sortAndFilterTweetModels(tweetModels, {
//     limitNumAfterModify: 250,
//     prioritizeFirstAppearUserTweet: true,
//     deprioritizeBlockedUser: true,
//     deprioritizeContainsSpecificWordsInText: true,
//     isBlockedTwitterUserByScreenNameHash: screenNameToBlockTwitterUserModelHash,
//     productModel: productModel,
//     prioritizeContainProductNameInText: true,
//     deprioritizeByNewLineCharCount: 9,
//   });
//
//   var tweetDataListForProductDetailPage = __.map(modifiedTweetModels, m => {
//     return [m.screenName, m.id, m.text];
//   });
//
//   var serializedTweetDataListForProductDetailPage = JSON.stringify(tweetDataListForProductDetailPage);
//   redis.set(cacheKey, serializedTweetDataListForProductDetailPage, "EX", (60 * 60) * 6); // 6 hours cache
//
//   res.send(serializedTweetDataListForProductDetailPage);
// });

