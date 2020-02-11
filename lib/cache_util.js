const appRoot = require('app-root-path');
const Config = require('config');
const memoryCache = require('memory-cache');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const CacheKeyGenerator = require(appRoot + '/lib/cache_key_generator.js');

var Redis = require("ioredis");
var redis = null;

const ProductBundle = require(appRoot + '/models/product_bundle');
const StatData = require(appRoot + '/models/stat_data.js');
const Tweet = require(appRoot + '/models/tweet');

function getRedisInstance() {
  if (redis) return redis;

  redis = new Redis({
    password: Config.redis.password,
  });

  return redis;
}

// async function getSimpleBuzzChartByProductBundleId(productBundleId) {
//   var redis = getRedisInstance();
//   var hashCacheKey = CacheKeyGenerator.getSortedTweetModelsHashCacheKey();
//   var sortedTweetModelsCacheKey = CacheKeyGenerator.generateSortedTweetModelsCacheKey(productBundleId);
//   return await redis.hget(hashCacheKey, sortedTweetModelsCacheKey);
// }
//
// function setSortedTweCache(productBundleId, sortedTweetModels) {
//   var redis = getRedisInstance();
//   var hashCacheKey = CacheKeyGenerator.getSortedTweetModelsHashCacheKey();
//   var sortedTweetModelsCacheKey = CacheKeyGenerator.generateSortedTweetModelsCacheKey(productBundleId);
//   var stringifiedSortedTweetModels = JSON.stringify(sortedTweetModels);
//   redis.hset(hashCacheKey, sortedTweetModelsCacheKey, stringifiedSortedTweetModels);
// }

// priority: memory cache > redis cache
// async function getCachedProductBundleIdIntoRelatedDataHash(cacheKey) {
//   var productBundleIdIntoRelatedDataHash;
//
//   if (productBundleIdIntoRelatedDataHash = memoryCache.get(cacheKey)) {
//     return productBundleIdIntoRelatedDataHash;
//   }
//
//   productBundleIdIntoRelatedDataHash = JSON.parse(await redis.get(cacheKey));
//   if (!productBundleIdIntoRelatedDataHash) return;
//
//   productBundleIdIntoRelatedDataHash = __.each(productBundleIdIntoRelatedDataHash, (data, productBundleId) => {
//     var rawHashProductDataList = data.productDataList;
//     var rawHashTweetModels = data.tweetModels;
//
//     // restore models (raw hash object => model object)
//     data.productBundleModel = new ProductBundle(data.productBundleModel);
//
//     __.each(rawHashProductDataList, productData => {
//       var ProductClass = sequelize.models[productData.productClassName];
//       productData.productModel = new ProductClass(productData.productModel);
//     });
//
//     var tweetModels = __.map(rawHashTweetModels, rawHashTweetModel => {
//       return new Tweet(rawHashTweetModel);
//     });
//     data.tweetModels = tweetModels;
//
//     if (data.statDataModel) {
//       data.statDataModel = new StatData(data.statDataModel);
//     }
//   });
//
//   await memoryCache.put(cacheKey, productBundleIdIntoRelatedDataHash);
//
//   return productBundleIdIntoRelatedDataHash;
// }

module.exports = {
  getRedisInstance,
};
