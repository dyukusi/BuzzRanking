const express = require('express');
const router = express.Router();
const memoryCache = require('memory-cache');
const ReleaseControl = require(appRoot + '/models/release_control.js');
const Util = require(appRoot + '/my_libs/util.js');
const Moment = require('moment');

const PRODUCT_NUM_PER_PAGE = 20;

router.get('/:product_type_bundle_name', function (req, res, next) {
  var queryParam = req.query || {};
  var page = Number(queryParam['page']) || 1;
  var productTypeBundleName = req.params.product_type_bundle_name;
  var productTypeId = Const.PRODUCT_TYPE_NAME_TO_ID_HASH[queryParam['type']] || null;
  var productTypeBundleId = Const.PRODUCT_TYPE_BUNDLE_NAME_TO_ID[productTypeBundleName];

  if (!productTypeBundleId) {
    return next(productTypeBundleName + ' is not defined');
  }

  ReleaseControl.selectLatestReleaseDate()
    .then(releaseControlModel => {
      renderRankingPage(productTypeBundleId, productTypeId, releaseControlModel.getDateMoment(), page, req, res, next);
    });
});

module.exports = router;

async function renderRankingPage(productTypeBundleId, targetProductTypeId, dateMoment, page, req, res, next) {
  var productTypeIds = targetProductTypeId ? [targetProductTypeId] : Const.PRODUCT_TYPE_BUNDLE_ID_TO_PRODUCT_TYPE_IDS[productTypeBundleId];
  var targetRankingHTMLCacheKey = 'html_ranking_' + productTypeIds.join('_') + '_' + dateMoment.format() + '_p' + page;
  var targetRankingHTMLCache = memoryCache.get(targetRankingHTMLCacheKey);
  var isAdmin = myUtil.isAdminByReq(req);
  var latestReleaseControlModel = await ReleaseControl.selectLatestReleaseDate();
  var latestReleaseDateMoment = latestReleaseControlModel.getDateMoment();

  // accessing to unreleased page that only admin can see
  if (latestReleaseDateMoment < dateMoment) {
    if (!isAdmin) {
      return res.redirect('/auth');
    }
  }

  // cache hit
  if (targetRankingHTMLCache && !isAdmin) {
    return res.send(targetRankingHTMLCache);
  }

  console.log("cache miss: " + targetRankingHTMLCacheKey);
  var [statModel, ranking] = await Util.buildRanking(productTypeIds, dateMoment);
  var pageMax = Math.ceil(ranking.length / PRODUCT_NUM_PER_PAGE);

  if (pageMax < page) {
    return next({
      message: 'Exceeded page limit. Page: ' + page + ' MaxPage: ' + pageMax,
      dispMessage: Const.ERROR_MESSAGE.PAGE_EXCEEDED,
    });
  }

  // slice for pagination
  var start = (page - 1) * PRODUCT_NUM_PER_PAGE;
  var end = start + PRODUCT_NUM_PER_PAGE;
  var slicedRankings = ranking.slice(start, end);

  // should not cache if admin
  if (!isAdmin) {
    res.sendResponse = res.send;
    res.send = (body) => {
      memoryCache.put(targetRankingHTMLCacheKey, body, 60 * 60 * 24 * 1000);
      res.sendResponse(body);
    };
  }

  var productIdToIsNewProductHash = null;

  // for displaying new product mark
  if (isAdmin) {
    productIdToIsNewProductHash = await Util.getProductIdToIsNewProductHash(statModel.id);
  }

  return res.render('ranking', {
    isAdmin: isAdmin,
    targetDateMoment: dateMoment,
    targetPage: page,
    pageMax: pageMax,
    latestStatDateMoment: latestReleaseDateMoment,
    ranking: slicedRankings,
    statModel: statModel,
    productTypeBundleId: productTypeBundleId,
    targetProductTypeId: targetProductTypeId,

    // for admin
    productIdToIsNewProductHash: productIdToIsNewProductHash,
  });
}

