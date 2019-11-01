const express = require('express');
const router = express.Router();
const NewTweet = require(appRoot + '/models/new_tweet');
const BookCaption = require(appRoot + '/models/book_caption');
const TweetCountLog = require(appRoot + '/models/tweet_count_log');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');
const Moment = require('moment');
const sequelize = require(appRoot + '/db/sequelize_config');
const cacheUtil = require(appRoot + '/my_libs/cache_util.js');

const PRODUCT_NUM_PER_PAGE_IN_LISTING_PAGE = 100;

router.get('/detail/:product_id', async function (req, res, next) {
  var productId = req.params.product_id;
  var htmlCacheKey = cacheUtil.generateProductDetailHTMLCacheKey(productId);
  var htmlCache = await redis.get(htmlCacheKey);

  if (htmlCache) {
    res.send(htmlCache);
    return;
  }

  console.log("cache miss: " + htmlCacheKey);

  var [productModels, bookCaptionModels, tweetCountLogModels, twitterAltSearchWordModels] = await Promise.all([
    Util.selectProductModels({
      productId: [productId],
    }),
    BookCaption.selectByProductIds([productId]),
    TweetCountLog.selectByProductId(productId),
    TwitterAlternativeSearchWord.selectByProductIds([productId]),
  ]);

  var targetProductModel = productModels[0];
  var targetBookCaption = bookCaptionModels[0];

  var sortedTweetCountLogModels = __.sortBy(tweetCountLogModels, m => {
    return new Moment(m.createdAt).unix();
  });

  var latestProductDataListCacheKey = await cacheUtil.generateLatestProductDataListCacheKey();
  var productDataList = await cacheUtil.getCachedProductDataList(latestProductDataListCacheKey);
  var top3ProductDataList = __.first(productDataList, 3);

  // html cache
  res.sendResponse = res.send;
  res.send = (body) => {
    redis.set(htmlCacheKey, body);
    res.sendResponse(body);
  };

  res.render('product_detail', {
    productModel: targetProductModel,
    bookCaptionModel: targetBookCaption,
    twitterAltSearchModels: twitterAltSearchWordModels,
    tweetCountLogModels: sortedTweetCountLogModels,
    top3ProductDataList: top3ProductDataList,

    Moment: Moment,
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

  var selectAllProductBasicInfoPromises = __.map(Const.PRODUCT_MODELS, productModel => {
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
