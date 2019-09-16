const express = require('express');
const router = express.Router();
const Util = require(appRoot + '/my_libs/util.js');
const Tweet = require(appRoot + '/models/tweet');
const BookCaption = require(appRoot + '/models/book_caption');
const TweetCountLog = require(appRoot + '/models/tweet_count_log');
const InvalidProduct = require(appRoot + '/models/invalid_product.js');
const ReleaseControl = require(appRoot + '/models/release_control.js');
const BlockTwitterUser = require(appRoot + '/models/block_twitter_user');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');
const Moment = require('moment');
const memoryCache = require('memory-cache');
const sequelize = require(appRoot + '/db/sequelize_config');
const PRODUCT_NUM_PER_PAGE = 100;

router.get('/detail/:product_id', function (req, res, next) {
  var productId = req.params.product_id;

  (async () => {
    var [productModels, bookCaptionModels, tweetModels, tweetCountLogModels, invalidProductModels, blockTwitterUserModels, twitterAltSearchWordModels] = await Promise.all([
      Util.selectProductModelsByProductIds([productId]),
      BookCaption.selectByProductIds([productId]),
      Tweet.selectByProductIds([productId]),
      TweetCountLog.selectByProductId(productId),
      InvalidProduct.selectByProductIds([productId]),
      BlockTwitterUser.findAll({}),
      TwitterAlternativeSearchWord.findAll({
        where: {
          productId: productId,
        },
      })
    ]);

    var targetProductModel = productModels[0];
    var targetBookCaption = bookCaptionModels[0];
    var screenNameToBlockTwitterUserModelHash = __.indexBy(blockTwitterUserModels, m => {
      return m.screenName;
    });

    var tweetDataArray = Util.buildTweetDataArray(tweetModels, {
      excludeUnnecessaryDataForDisplay: true,
      prioritizeFirstAppearUserTweet: true,
      deprioritizeBlockedUser: true,
      screenNameToBlockTwitterUserModelHash: screenNameToBlockTwitterUserModelHash,
      deprioritizeContainsSpecificWordsInText: true,
    });

    var isInvalidProduct = !!invalidProductModels[0];

    var sortedTweetCountLogModels = __.sortBy(tweetCountLogModels, m => {
      return new Moment(m.createdAt).unix();
    });

    var top3RankingData = await getTop3RankingData(targetProductModel.productTypeId);

    res.render('product_detail', {
      productModel: targetProductModel,
      bookCaptionModel: targetBookCaption,
      twitterAltSearchModels: twitterAltSearchWordModels,
      tweetDataArray: tweetDataArray,
      tweetCountLogModels: sortedTweetCountLogModels,
      isInvalidProduct: isInvalidProduct,
      top3RankingData: top3RankingData,

      Moment: Moment,
    });
  })()
    .catch((e) => {
      next(e);
    });
});

async function getTop3RankingData(productTypeId) {
  var releaseControlModel = await ReleaseControl.selectLatestReleaseDate();
  var productTypeBundleId = Const.PRODUCT_TYPE_ID_TO_BELONGED_PRODUCT_TYPE_BUNDLE_ID[productTypeId];
  var targetDateMoment = releaseControlModel.getDateMoment();
  var top3RankingCacheKey = 'ranking_top3_' + productTypeId + '_' + targetDateMoment.format();
  var top3RankingCache = memoryCache.get(top3RankingCacheKey);

  if (top3RankingCache) {
    return top3RankingCache;
  }

  var [statModel, ranking] = await Util.buildRanking([productTypeId], targetDateMoment);
  var top3Ranking = __.first(ranking, 3);

  memoryCache.put(top3RankingCacheKey, top3Ranking);

  return top3Ranking;
}

router.get('/list', async function (req, res, next) {
  var queryParam = req.query || {};
  var targetPage = Number(queryParam['page']) || 1;
  var buildProductBasicInfosOptions = {
    productTypeId: Number(queryParam['product_type_id']) || null,
    searchWord: queryParam['search_word'] || null,
  };

  var productBasicInfos = await buildProductBasicInfos(buildProductBasicInfosOptions);
  var detectedProductCount = productBasicInfos.length;
  var pageMax = Math.ceil(productBasicInfos.length / PRODUCT_NUM_PER_PAGE) || 1;
  var start = (targetPage - 1) * PRODUCT_NUM_PER_PAGE;
  var end = start + PRODUCT_NUM_PER_PAGE;
  var targetProductBasicInfos = productBasicInfos.slice(start, end);

  res.render('product_list', {
    targetPage: targetPage,
    pageMax: pageMax,
    productBasicInfos: targetProductBasicInfos,
    detectedProductCount: detectedProductCount,
    options: buildProductBasicInfosOptions,
  });
});

async function buildProductBasicInfos(options = {}) {
  var baseSQL = "SELECT product_id, product_type_id, title FROM %s WHERE true";
  var replacements = {};

  if (options.productTypeId) {
    baseSQL += " AND product_type_id = :productTypeId";
    replacements.productTypeId = options.productTypeId;
  }

  if (options.searchWord) {
    baseSQL += " AND MATCH(title) AGAINST(:searchWord);";
    replacements.searchWord = options.searchWord;
  }

  var selectAllProductBasicInfoPromises = __.map(Const.PRODUCT_TABLE_NAMES, tableName => {
    return sequelize.query(
      sprintf(baseSQL, tableName),
      {
        replacements: replacements,
        type: sequelize.QueryTypes.SELECT,
      }
    );
  });

  var results = await Promise.all(selectAllProductBasicInfoPromises);
  var productBasicInfos = __.chain(results)
    .flatten()
    .map(row => {
      return {productId: row.product_id, productTypeId: row.product_type_id, title: row.title,};
    })
    .sortBy(data => {
      return data.productId;
    })
    .value();

  return productBasicInfos;
}

module.exports = router;
