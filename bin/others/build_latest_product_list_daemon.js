const appRoot = require('app-root-path');
const Util = require(appRoot + '/lib/util.js');
const Const = require(appRoot + '/lib/const.js');
const _ = require('underscore');
const ReleaseControl = require(appRoot + '/models/release_control.js');
const Poller = require(appRoot + '/lib/poller.js');
const CacheKeyGenerator = require(appRoot + '/lib/cache_key_generator.js');
const CacheUtil = require(appRoot + '/lib/cache_util.js');
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
const ProductUtil = require(appRoot + '/lib/product_util.js');
const Moment = require('moment');

const argDateStr = process.argv[2];
var isForceBuild = !!Number(process.argv[3]);
var redis = CacheUtil.getRedisInstance();

var buildLatestRankingPoller = new Poller(500);
buildLatestRankingPoller.onPoll(async () => {
  var latestReleaseControlModel = await ReleaseControl.selectLatest();
  var targetMoment = argDateStr ? new Moment(argDateStr) : latestReleaseControlModel.getMoment();
  var statModel = await Stat.selectByMoment(targetMoment);
  var cacheKey = CacheKeyGenerator.generateRankedProductsCacheKeyByStatId(statModel.id);
  var productDataListCache = await redis.get(cacheKey);

  if (productDataListCache && !isForceBuild) {
    return buildLatestRankingPoller.poll();
  }
  isForceBuild = false;

  console.log("building product data caches... statId: " + statModel.id + " date: " + statModel.statDate);
  // TODO: too heavy calc time. need optimization
  var productBundleIdIntoRelatedDataHash = await ProductUtil.buildProductBundleIdIntoRelatedDataHashByStatId(statModel.id, {
    selectTweetNumPerGroup: 200,
  });

  redis.set(cacheKey, JSON.stringify(productBundleIdIntoRelatedDataHash));

  // TODO
  // create top3 productDataList per product type id
  // var productTypeIdIntoProductDataList = _.groupBy(productBundleIdIntoRelatedDataHash, productData => {
  //   return productData.productModel.productTypeId;
  // });
  // _.each(productTypeIdIntoProductDataList, (productDataList, productTypeId) => {
  //   var key = CacheKeyGenerator.generateTop3RankProductDataListCacheKey(statModel.id, productTypeId);
  //   var top3ProductDataList = _.first(productDataList, 3);
  //   redis.set(key, JSON.stringify(top3ProductDataList));
  // });

  console.log("Ranking object have been successfully built and cached!!! cache key: " + cacheKey);

  buildLatestRankingPoller.poll();
});

buildLatestRankingPoller.poll();
