var express = require('express');
var router = express.Router();
const Config = require('config');
const memoryCache = require('memory-cache');
const ReleaseControl = require(appRoot + '/models/release_control.js');
const Util = require(appRoot + '/my_libs/util.js');

router.get('/', function (req, res, next) {
  // (async () => {
  //   var latestReleaseControlModel = await ReleaseControl.selectLatestReleaseDate();
  //   var allProductTypeIds = __.values(Const.PRODUCT_TYPE_NAME_TO_ID_HASH);
  //   var [statModel, ranking] = await Util.buildRanking(allProductTypeIds, latestReleaseControlModel.getDateObj());
  //
  //   var productTypeBundleIdToRankingInfos = __.groupBy(ranking, data => {
  //     return Const.PRODUCT_TYPE_ID_TO_BELONGED_PRODUCT_TYPE_BUNDLE_ID[data.productModel.productTypeId];
  //   });
  //
  //   var sortedProductTypeBundleIds = __.chain(__.keys(productTypeBundleIdToRankingInfos))
  //     .sortBy(productTypeBundleId => {
  //       return productTypeBundleIdToRankingInfos[productTypeBundleId][0].statDataModel.userCount;
  //     })
  //     .reverse()
  //     .value();
  //
  //   res.render('index', {
  //     sortedProductTypeBundleIds: sortedProductTypeBundleIds,
  //     productTypeBundleIdToRankingInfos: productTypeBundleIdToRankingInfos,
  //   });
  // })()
  //   .catch(e => {
  //     throw new Error(e);
  //   });
  //

  res.render('index', {});
});

router.get('/sitemap', function (req, res, next) {
  res.render('sitemap', {});
});

router.get('/health', function (req, res, next) {
  res.render('health', {});
});

router.get('/ads.txt', function (req, res, next) {
  res.send(Config.google_adsense_ads_txt);
});

module.exports = router;
