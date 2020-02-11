const appRoot = require('app-root-path');
const express = require('express');
const router = express.Router();
const __ = require('underscore');

const Util = require(appRoot + '/lib/util.js');
const CONST = require(appRoot + '/lib/const.js');
const CacheKeyGenerator = require(appRoot + '/lib/cache_key_generator.js');
const CacheUtil = require(appRoot + '/lib/cache_util.js');
const ProductUtil = require(appRoot + '/lib/product_util.js');

const ProductBundle = require(appRoot + '/models/product_bundle');
const ReleaseControl = require(appRoot + '/models/release_control.js');
const Ranking = require(appRoot + '/models/ranking.js');
const ProductTweetStat = require(appRoot + '/models/product_tweet_stat');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

// admin settings
const ENABLE_HTML_CACHE = false;

router.get('/', async function (req, res, next) {
  var isAdmin = Util.isAdminByReq(req);
  var queryString = req.query || {};
  var rankingTypeName = queryString['rtype'] || 'BUZZ';
  var rankingTypeId = CONST.RANKING_TYPE_NAME_TO_ID_HASH[rankingTypeName.toUpperCase()];
  var productTypeBundleId = CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID_HASH[(queryString['category'] || '').toUpperCase()] || CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID_HASH.ALL;
  var productTypeId = CONST.PRODUCT_TYPE_NAME_TO_ID_HASH[(queryString['type'] || '').toUpperCase()] || CONST.PRODUCT_TYPE_NAME_TO_ID_HASH.ALL;
  var page = Number(queryString['page']) || 1;
  var latestReleaseControlModel = await ReleaseControl.selectLatest();
  var targetDateStr = latestReleaseControlModel.getMoment().format('YYYY-MM-DD');
  var redis = CacheUtil.getRedisInstance();

  if (!rankingTypeName || !rankingTypeId) {
    return next('undefined ranking type name: ' + rankingTypeName);
  }

  var htmlCacheKey = CacheKeyGenerator.generateHtmlCacheForRanking(
    targetDateStr,
    rankingTypeName,
    productTypeBundleId,
    productTypeId,
    page
  );
  var htmlCache = await redis.get(htmlCacheKey);

  // html cache hit
  if (htmlCache && ENABLE_HTML_CACHE && !isAdmin) {
    return res.send(htmlCache);
  }

  console.log("html cache miss: " + htmlCacheKey);

  var rankingModels;
  var start;
  var end;

  // === DEBUG FOR ADMIN ===
  if (isAdmin && req.query.debug_product_bundle_ids) {
    var debugTargetProductBundleIds = __.map(req.query.debug_product_bundle_ids.split(','), productBundleIdStr => {
      return +productBundleIdStr;
    });

    // create dummy ranking models
    rankingModels = __.map(debugTargetProductBundleIds, productBundleId => {
      return new Ranking({
        date: targetDateStr,
        type: rankingTypeId,
        productTypeBundleId: productTypeBundleId,
        productTypeId: productTypeId,
        productBundleId: productBundleId,
        rank: -1,
      });
    });

    start = (page - 1) * CONST.PRODUCT_NUM_PER_PAGE;
    end = start + CONST.PRODUCT_NUM_PER_PAGE;
  }
  // === NORMAL PROCESS ===
  else {
    rankingModels = __.chain(await Ranking.findAll({
      where: {
        date: targetDateStr,
        type: rankingTypeId,
        productTypeBundleId: productTypeBundleId,
        productTypeId: productTypeId,
      },
    }))
      .sortBy(rankingModel => {
        return rankingModel.rank; // ASC
      })
      .value();

    start = (page - 1) * CONST.PRODUCT_NUM_PER_PAGE;
    end = start + CONST.PRODUCT_NUM_PER_PAGE;
  }

  var targetRankingModels = rankingModels.slice(start, end);
  var productBundleIds = __.map(targetRankingModels, m => {
    return m.productBundleId;
  });

  var [
    productBundleIdIntoProductDataHash,
    productBundleIdIntoTweetModelsHash,
    productBundleIdIntoProductTweetStatModelHash,
    productBundleIdIntoSearchWordsHash,
    adDataList,
  ] = await Promise.all([
    ProductUtil.loadProductDataHashByProductBundleIds(productBundleIds, {
      ignoreCache: isAdmin,
      includeAllProduct: isAdmin
    }),
    ProductUtil.loadSortedTweetModelsHashByProductBundleIds(productBundleIds),
    (async () => {
      var productTweetStatModels = await ProductTweetStat.findAll({
        where: {
          productBundleId: productBundleIds,
        },
      });
      return __.indexBy(productTweetStatModels, m => {
        return m.productBundleId;
      });
    })(),
    ProductUtil.buildProductBundleIdIntoSearchWordsHashByProductBundleIds(productBundleIds),
    ProductUtil.loadSimpleRankingDataList(latestReleaseControlModel.getMoment().format('YYYY-MM-DD')),
  ]);

  // prepare for html cache
  if (!isAdmin && ENABLE_HTML_CACHE) {
    res.sendResponse = res.send;
    res.send = (body) => {
      redis.set(htmlCacheKey, body);
      res.sendResponse(body);
    };
  }

  // for debug data
  var debugData = {};
  if (isAdmin) {
    debugData = await createDataForDebug(productBundleIds);
  }

  return res.render('ranking', {
    isAdmin: isAdmin,
    originalURL: req.originalUrl,
    targetPage: page,
    totalRankedNum: rankingModels.length,

    rankingTypeId: rankingTypeId,
    productTypeBundleId: productTypeBundleId,
    productTypeId: productTypeId,

    rankingModels: targetRankingModels,
    productBundleIdIntoProductDataHash: productBundleIdIntoProductDataHash,
    productBundleIdIntoTweetModelsHash: productBundleIdIntoTweetModelsHash,
    productBundleIdIntoProductTweetStatModelHash: productBundleIdIntoProductTweetStatModelHash,
    productBundleIdIntoSearchWordsHash: productBundleIdIntoSearchWordsHash,
    adDataList: adDataList,

    // ---------- below data can be used only with admin mode --------------
    debugData: debugData,

    // targetDateMoment: targetMoment,
    // productDataList: targetProductDataList,
    // lastUpdateMoment: latestReleaseControlModel.getMoment(),
    // productTypeBundleId: targetProductTypeBundleId,
    // targetProductTypeId: targetProductTypeId,
    // isDateSpecified: !!queryString['date'],
  });

});

async function createDataForDebug(productBundleIds) {
  var productBundleModels = await ProductBundle.findAll({
    where: {
      id: productBundleIds,
    }
  });

  var twitterAltSearchWordModels = await TwitterAlternativeSearchWord.findAll({
    where: {
      productBundleId: productBundleIds,
    },
  });

  var productBundleIdIntoTwitterAltSearchWordModelsHash = __.groupBy(twitterAltSearchWordModels, m => {
    return m.productBundleId;
  });

  var protectedProductBundleModels = __.filter(productBundleModels, m => {
    return m.isProtected();
  });

  var productBundleIdIntoChildCandidateProductModels = {};
  var productBundleIdIntoParentProductDataHash = {};
  for (var i = 0; i < protectedProductBundleModels.length; i++) {
    var productBundleModel = protectedProductBundleModels[i];
    var productModels = await ProductUtil.selectProductModels({
      title: {
        [Op.like]: '%' + productBundleModel.name + '%',
      },
      productBundleId: {
        [Op.or]: [
          {
            [Op.ne]: productBundleModel.id,
          },
          {
            [Op.eq]: null,
          }
        ],
      },
    });

    productBundleIdIntoChildCandidateProductModels[productBundleModel.id] = productModels;

    var parentProductDataList = await Promise.all(__.compact(__.map(productModels, m => {
      if (!m.productBundleId) return null;
      return ProductUtil.loadProductDataByProductBundleId(m.productBundleId);
    })));

    __.each(parentProductDataList, m => {
      if (!m.productBundleModel) return;
      productBundleIdIntoParentProductDataHash[m.productBundleModel.id] = m;
    });
  }

  return {
    productBundleIdIntoTwitterAltSearchWordModelsHash,
    productBundleIdIntoChildCandidateProductModels,
    productBundleIdIntoParentProductDataHash,
  };
}


module.exports = router;
