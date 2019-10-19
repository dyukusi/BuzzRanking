const express = require('express');
const router = express.Router();
const memoryCache = require('memory-cache');
const ReleaseControl = require(appRoot + '/models/release_control.js');
const Util = require(appRoot + '/my_libs/util.js');
const Moment = require('moment');
const Poller = require(appRoot + '/my_libs/poller.js');
const Const = require(appRoot + '/my_libs/const.js');

// admin settings
const DISABLE_HTML_CACHE = true;
const enableDisplayOnlyNewProducts = false;

// this build latest Ranking object every 3 seconds if need
var buildLatestRankingPoller = new Poller(3000);
buildLatestRankingPoller.onPoll(async () => {
  var latestReleaseControlModel = await ReleaseControl.selectLatestReleaseDate();
  var targetMoment = latestReleaseControlModel.getDateMoment();

  if (!Util.isCachedRanking(targetMoment)) {
    console.log("building latest ranking object... " + targetMoment.format());
    var ranking = await Util.buildRankingByDateMoment(targetMoment)
    console.log("Ranking object was successfully built!!! :) " + targetMoment.format());
  }

  buildLatestRankingPoller.poll();
});
buildLatestRankingPoller.poll();

router.get('/:product_type_bundle_name', async function (req, res, next) {
  var queryParam = req.query || {};
  var page = Number(queryParam['page']) || 1;
  var productTypeBundleName = req.params.product_type_bundle_name;
  var productTypeId = Const.PRODUCT_TYPE_NAME_TO_ID_HASH[queryParam['type']] || null;
  var productTypeBundleId = Const.PRODUCT_TYPE_BUNDLE_NAME_TO_ID[productTypeBundleName];
  var isAdmin = myUtil.isAdminByReq(req);

  if (!productTypeBundleId) {
    return next(productTypeBundleName + ' is not defined');
  }

  // date function is only for admin
  if (!!queryParam['date'] && !isAdmin) {
    return res.redirect('/auth');
  }

  var releaseControlModel = await ReleaseControl.selectLatestReleaseDate();
  var targetMoment = queryParam['date'] ? new Moment(queryParam['date']) : releaseControlModel.getDateMoment();

  await renderRankingPage(productTypeBundleId, productTypeId, targetMoment, page, req, res, next);
});

async function renderRankingPage(productTypeBundleId, targetProductTypeId, dateMoment, page, req, res, next) {
  var queryParam = req.query || {};
  var productTypeIds = targetProductTypeId ? [targetProductTypeId] : Const.PRODUCT_TYPE_BUNDLE_ID_TO_PRODUCT_TYPE_IDS[productTypeBundleId];
  var targetRankingHTMLCacheKey = 'html_ranking_' + (targetProductTypeId || 'bundle_' + productTypeBundleId) + '_' + dateMoment.format() + '_p' + page;
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

  // only display new products if Admin
  if (isAdmin && enableDisplayOnlyNewProducts) {
    var productIdToIsNewProductHash = await Util.getProductIdToIsNewProductHash(statModel.id);

    ranking = __.filter(ranking, data => {
      return productIdToIsNewProductHash[data.productModel.productId];
    });
  }

  var pageMax = Math.ceil(ranking.length / Const.PRODUCT_NUM_PER_PAGE) || 1;

  if (pageMax < page) {
    return next({
      message: 'Exceeded page limit. Page: ' + page + ' MaxPage: ' + pageMax,
      dispMessage: Const.ERROR_MESSAGE.PAGE_EXCEEDED,
    });
  }

  // slice for pagination
  var start = (page - 1) * Const.PRODUCT_NUM_PER_PAGE;
  var end = start + Const.PRODUCT_NUM_PER_PAGE;
  var slicedRankings = ranking.slice(start, end);

  // should not cache if admin
  if (!isAdmin && !DISABLE_HTML_CACHE) {
    res.sendResponse = res.send;
    res.send = (body) => {
      memoryCache.put(targetRankingHTMLCacheKey, body, 60 * 60 * 24 * 1000);
      res.sendResponse(body);
    };
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
    isDateSpecified: !!queryParam['date'],
    rank1Buzz: ranking[0] ? ranking[0].statDataModel.buzz : 0,

    // for admin
    productIdToIsNewProductHash: productIdToIsNewProductHash,
  });
}

module.exports = router;
