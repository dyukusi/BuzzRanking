const express = require('express');
const router = express.Router();
const cluster = require('cluster');
const ReleaseControl = require(appRoot + '/models/release_control.js');
const Moment = require('moment');
const Const = require(appRoot + '/my_libs/const.js');
const Stat = require(appRoot + '/models/stat.js');
const StatData = require(appRoot + '/models/stat_data.js');
const slaveManager = require(appRoot + '/my_libs/slave_manager.js');
const cacheUtil = require(appRoot + '/my_libs/cache_util.js');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');

// admin settings
const ENABLE_HTML_CACHE = false;

// for testing
router.get('/testing', async function (req, res, next) {
  var queryParam = req.query || {};
  var isAdmin = Util.isAdminByReq(req);
  var page = Number(queryParam['page']) || 1;

  if (!isAdmin) {
    return res.redirect('/auth');
  }

  var productDataList = await cacheUtil.getCachedProductDataList(cacheUtil.getProductDataListForDebugCacheKey(), {
    restoreProductModel: true,
  });

  var productIdIntoTwitterAltSearchWordModelsHash = __.groupBy(await TwitterAlternativeSearchWord.selectAllValid(), m => {
    return m.productId;
  });

  var pageMax = Math.ceil(productDataList.length / Const.PRODUCT_NUM_PER_PAGE) || 1;

  return res.render('ranking', {
    isAdmin: isAdmin,
    targetPage: page,
    productDataList: productDataList,
    lastUpdateMoment: null,
    productTypeBundleId: null,
    targetProductTypeId: null,
    isDateSpecified: null,
    originalURL: req.originalUrl,
    pageMax: pageMax,

    // for admin
    productIdIntoTwitterAltSearchWordModelsHash: productIdIntoTwitterAltSearchWordModelsHash,
  });
});

router.get('/:product_type_bundle_name', async function (req, res, next) {
  var isAdmin = Util.isAdminByReq(req);
  var queryParam = req.query || {};
  var page = Number(queryParam['page']) || 1;
  var targetProductTypeBundleName = req.params.product_type_bundle_name;
  var targetProductTypeBundleId = Const.PRODUCT_TYPE_BUNDLE_NAME_TO_ID[targetProductTypeBundleName];
  var targetProductTypeId = Const.PRODUCT_TYPE_NAME_TO_ID_HASH[queryParam['type']] || null;
  var targetProductTypeIds = targetProductTypeId ? [targetProductTypeId] : Const.PRODUCT_TYPE_BUNDLE_ID_TO_PRODUCT_TYPE_IDS[targetProductTypeBundleId];
  var latestReleaseControlModel = await ReleaseControl.selectLatestReleaseDate();
  var targetMoment = process.argv[2] ? new Moment(process.argv[2]) : latestReleaseControlModel.getDateMoment();
  // var targetMoment = queryParam['date'] ? new Moment(queryParam['date']) : latestReleaseControlModel.getDateMoment();
  var htmlCacheKey = 'html_ranking_' + (targetProductTypeId || 'bundle_' + targetProductTypeBundleId) + '_' + targetMoment.format("YYYY-MM-DD") + '_p' + page;
  var htmlCache = await redis.get(htmlCacheKey);

  if (!targetProductTypeBundleId) {
    return next(targetProductTypeBundleName + ' is not defined');
  }

  // date function is only for admin
  if (!!queryParam['date'] && !isAdmin) {
    return res.redirect('/auth');
  }

  // html cache hit
  if (htmlCache && ENABLE_HTML_CACHE && !isAdmin) {
    return res.send(htmlCache);
  }

  console.log("html cache miss: " + htmlCacheKey);

  var statModel = await Stat.selectByRankingDate(targetMoment);
  var productDataListCacheKey = cacheUtil.generateProductDataListCacheKeyByStatId(statModel.id);
  var allProductDataList = await cacheUtil.getCachedProductDataList(productDataListCacheKey);

  // product list object cache miss
  if (!allProductDataList) {
    console.log("product data list cache miss: " + productDataListCacheKey);
    return next({
      message: 'preparing product data list: ' + productDataListCacheKey,
      dispMessage: Const.ERROR_MESSAGE.IN_PREPARING_RANKING,
    });
  }

  var targetProductDataList = __.filter(allProductDataList, productData => {
    return __.contains(targetProductTypeIds, productData.productModel.productTypeId);
  });

  var pageMax = Math.ceil(targetProductDataList.length / Const.PRODUCT_NUM_PER_PAGE) || 1;
  if (pageMax < page) {
    return next({
      message: 'Exceeded page limit. Page: ' + page + ' MaxPage: ' + pageMax,
      dispMessage: Const.ERROR_MESSAGE.PAGE_EXCEEDED,
    });
  }

  // html cache
  if (!isAdmin && ENABLE_HTML_CACHE) {
    res.sendResponse = res.send;
    res.send = (body) => {
      redis.set(htmlCacheKey, body);
      res.sendResponse(body);
    };
  }

  var productIdIntoTwitterAltSearchWordModelsHash;
  if (isAdmin) {
    productIdIntoTwitterAltSearchWordModelsHash = __.groupBy(await TwitterAlternativeSearchWord.selectAllValid(), m => {
      return m.productId;
    });
  }

  return res.render('ranking', {
    isAdmin: isAdmin,
    pageMax: pageMax,
    targetDateMoment: targetMoment,
    targetPage: page,
    productDataList: targetProductDataList,
    lastUpdateMoment: latestReleaseControlModel.getDateMoment(),
    productTypeBundleId: targetProductTypeBundleId,
    targetProductTypeId: targetProductTypeId,
    isDateSpecified: !!queryParam['date'],
    originalURL: req.originalUrl,

    // for admin
    productIdIntoTwitterAltSearchWordModelsHash: productIdIntoTwitterAltSearchWordModelsHash,
  });

});

module.exports = router;
