global.appRoot = require('app-root-path');
global.Util = require(appRoot + '/my_libs/util.js');
global.Const = require(appRoot + '/my_libs/const.js');
global._ = require('underscore');
global.ReleaseControl = require(appRoot + '/models/release_control.js');
global.Stat = require(appRoot + '/models/stat.js');
global.StatData = require(appRoot + '/models/stat_data.js');
global.Poller = require(appRoot + '/my_libs/poller.js');
global.cacheUtil = require(appRoot + '/my_libs/cache_util.js');
global.sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
global.Moment = require('moment');

const argDateStr = process.argv[2];
var redis = cacheUtil.createRedisInstance();

var buildLatestRankingPoller = new Poller(3000);
buildLatestRankingPoller.onPoll(async () => {
  var latestReleaseControlModel = await ReleaseControl.selectLatestReleaseDate();
  var targetMoment = argDateStr ? new Moment(argDateStr) : latestReleaseControlModel.getDateMoment();
  var statModel = await Stat.selectByRankingDate(targetMoment);
  var cacheKey = cacheUtil.generateProductDataListCacheKeyByStatId(statModel.id);
  var productDataListCache = await redis.get(cacheKey);

  if (productDataListCache) {
    return buildLatestRankingPoller.poll();
  }

  console.log("building latest ranking object... statId: " + statModel.id + " date: " + statModel.rankingDate);
  var statDataModels = await StatData.selectByStatId(statModel.id);
  var productIdIntoStatDataModelHash = _.indexBy(statDataModels, m => {
    return m.productId;
  });
  var sortedProductIds = _.chain(statDataModels)
    .sortBy(m => {
      return -1 * m.buzz;
    })
    .map(m => {
      return m.productId;
    })
    .value();

  // TODO: too heavy calc time. need optimization
  var productDataList = await Util.buildProductDataListObject(sortedProductIds, {
    excludeInvalidProduct: true,
    selectTweetNumPerGroup: 200,
    tweetSelectOptions: {
      excludeInvalidTweets: true,
      // since: targetMoment.subtract(3, 'day').format("YYYY-MM-DD"),
      until: targetMoment.add(1, 'day').format("YYYY-MM-DD"),
    },
  });

  _.each(productDataList, productData => {
    var productId = productData.productModel.productId;
    productData.statDataModel = productIdIntoStatDataModelHash[productId];
  });

  redis.set(cacheKey, JSON.stringify(productDataList));

  // create top3 productDataList per product type id
  var productTypeIdIntoProductDataList = _.groupBy(productDataList, productData => {
    return productData.productModel.productTypeId;
  });
  _.each(productTypeIdIntoProductDataList, (productDataList, productTypeId) => {
    var key = cacheUtil.generateTop3RankProductDataListCacheKey(statModel.id, productTypeId);
    var top3ProductDataList = _.first(productDataList, 3);
    redis.set(key, JSON.stringify(top3ProductDataList));
  });

  console.log("Ranking object have been successfully built and cached!!! cache key: " + cacheKey);

  buildLatestRankingPoller.poll();
});

buildLatestRankingPoller.poll();
