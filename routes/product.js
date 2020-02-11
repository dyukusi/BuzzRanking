const appRoot = require('app-root-path');
const express = require('express');
const __ = require('underscore');
const router = express.Router();
const Moment = require('moment');
const CONST = require(appRoot + '/lib/const.js');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Op = Sequelize.Op;
const TweetCountLog = require(appRoot + '/models/tweet_count_log');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');
const CacheKeyGenerator = require(appRoot + '/lib/cache_key_generator.js');;
const ReleaseControl = require(appRoot + '/models/release_control.js');
const Ranking = require(appRoot + '/models/ranking.js');
const ProductUtil = require(appRoot + '/lib/product_util.js');
const CacheUtil = require(appRoot + '/lib/cache_util.js');
const ProductTweetStat = require(appRoot + '/models/product_tweet_stat');

const PRODUCT_NUM_PER_PAGE_IN_LISTING_PAGE = 100;

router.get('/:productBundleId', async function (req, res, next) {
  var queryParam = req.query || {};
  var focusProductId = queryParam.focus_product_id;
  var productBundleId = req.params.productBundleId;
  var htmlCacheKey = CacheKeyGenerator.generateProductBundleDetailHTMLCacheKey(productBundleId);
  var redis = CacheUtil.getRedisInstance();
  var htmlCache = await redis.get(htmlCacheKey);

  if (htmlCache && false) {
    res.send(htmlCache);
    return;
  }

  console.log("cache miss: " + htmlCacheKey);
  var productData = await ProductUtil.loadProductDataByProductBundleId(productBundleId);
  var productBundleModel = productData.productBundleModel;
  var productModels = productData.productModels;
  var productTypeBundleIdForAd = +__.chain(productModels)
    .countBy(m => {
      return m.getBelongedProductTypeBundleId();
    })
    .map((count, productTypeId) => {
      return {count: count, productTypeBundleId: productTypeId,};
    })
    .max(data => {
      return data.count;
    })
    .value().productTypeBundleId;

  var latestReleaseControlModel = await ReleaseControl.selectLatest();

  var [
    twitterSearchWords,
    searchWordIntoCreatedAtMomentHash,
    sortedTweetModels,
    rankingModels,
    productTweetStatModels,
    tweetCountLogModel,
    adDataList,
  ] = await Promise.all([
    ProductUtil.buildTwitterSearchWordsByProductBundleId(productBundleModel.id),

    // NOTE: unefficient process. should have merge with buildTwitterSearchWordsByProductBundleId
    (async () => {
      var result = {};
      var models = await TwitterAlternativeSearchWord.findAll({
        where: {
          productBundleId: productBundleModel.id,
        }
      });
      __.each(models, m => {
        result[m.searchWord] = new Moment(m.createdAt);
      });
      return result;
    })(),

    ProductUtil.loadSortedTweetModelsByProductBundleId(productBundleModel.id),

    Ranking.findAll({
      where: {
        productBundleId: productBundleModel.id,
        date: {
          [Op.lte]: latestReleaseControlModel.getMoment().format('YYYY-MM-DD'),
        },
      },
    }),

    ProductTweetStat.selectByProductBundleId(productBundleModel.id),

    TweetCountLog.findOne({
      where: {
        productBundleId: productBundleModel.id,
      },
      order: [
        ['created_at', 'DESC'],
      ],
    }),

    ProductUtil.loadSimpleRankingDataList(latestReleaseControlModel.getMoment().format('YYYY-MM-DD')),
  ]);

  // html cache
  res.sendResponse = res.send;
  res.send = (body) => {
    redis.set(htmlCacheKey, body);
    res.sendResponse(body);
  };

  res.render('product_detail', {
    productData: productData,
    focusProductId: focusProductId,
    rankingModels: rankingModels,
    productTweetStatModels: productTweetStatModels,
    tweetModels: sortedTweetModels,
    twitterSearchWords: twitterSearchWords,
    searchWordIntoCreatedAtMomentHash: searchWordIntoCreatedAtMomentHash,
    adDataList: adDataList,
    tweetCountLogModel: tweetCountLogModel,
    productTypeBundleIdForAd: productTypeBundleIdForAd,
  });
});

router.get('/list', async function (req, res, next) {
  var queryParam = req.query || {};
  var targetPage = Number(queryParam['page']) || 1;
  var buildProductBasicInfosOptions = {
    productTypeId: Number(queryParam['product_type_id']) || null,
    searchWord: queryParam['search_word'] || null,
  };

  var productBasicInfos = await buildProductBasicInfos(buildProductBasicInfosOptions);
  var detectedProductCount = productBasicInfos.length;
  var pageMax = Math.ceil(productBasicInfos.length / PRODUCT_NUM_PER_PAGE_IN_LISTING_PAGE) || 1;
  var start = (targetPage - 1) * PRODUCT_NUM_PER_PAGE_IN_LISTING_PAGE;
  var end = start + PRODUCT_NUM_PER_PAGE_IN_LISTING_PAGE;
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

  var selectAllProductBasicInfoPromises = __.map(ProductUtil.getAllProductModelClass(), productModel => {
    return sequelize.query(
      sprintf(baseSQL, productModel.name),
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
