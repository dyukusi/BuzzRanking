const appRoot = require('app-root-path');
const Config = require('config');
const memoryCache = require('memory-cache');
const StatData = require(appRoot + '/models/stat_data.js');
const ReleaseControl = require(appRoot + '/models/release_control.js');
const Stat = require(appRoot + '/models/stat.js');
var Redis = require("ioredis");

function createRedisInstance() {
  return new Redis({
    password: Config.redis.password,
  });
}

function getProductDataListForDebugCacheKey() {
  return 'product_data_list_for_debug';
}

function generateProductDataListCacheKeyByStatId(statId) {
  return 'product_data_list_' + statId;
}

async function generateLatestProductDataListCacheKey() {
  var latestReleaseControlModel = await ReleaseControl.selectLatestReleaseDate();
  var statModel = await Stat.selectByRankingDate(latestReleaseControlModel.getDateMoment());
  return generateProductDataListCacheKeyByStatId(statModel.id);
}

function generateTop3RankProductDataListCacheKeyByProductTypeId(productTypeId) {
  return 'top_3_product_data_list_per_product_type_id_' + productTypeId;
}

function generateTweetDataListForProductDetailPageCacheKey(productId) {
  return 'tweet_data_list_for_product_detail_page_' + productId;
}

function generateProductDetailHTMLCacheKey(productId) {
  return 'product_detail_html_' + productId;
}

// priority: memory cache > redis cache
async function getCachedProductDataList(cacheKey) {
  var productDataList;

  if (productDataList = memoryCache.get(cacheKey)) {
    console.log("cache from memory");
    return productDataList;
  }

  productDataList = JSON.parse(await redis.get(cacheKey));
  if (!productDataList) return;

  productDataList = __.each(productDataList, productData => {
    var ProductModelClass = Const.PRODUCT_MODEL_NAME_TO_MODEL_CLASS[productData.productClassName];
    productData.productModel = new ProductModelClass(productData.productModel);

    if (productData.statDataModel) {
      productData.statDataModel = new StatData(productData.statDataModel);
    }
  });

  memoryCache.put(cacheKey, productDataList);

  console.log("cache from redis");
  return productDataList;
}

module.exports = {
  getCachedProductDataList: getCachedProductDataList,
  createRedisInstance: createRedisInstance,
  generateProductDataListCacheKeyByStatId: generateProductDataListCacheKeyByStatId,
  generateTop3RankProductDataListCacheKeyByProductTypeId: generateTop3RankProductDataListCacheKeyByProductTypeId,
  getProductDataListForDebugCacheKey: getProductDataListForDebugCacheKey,
  generateLatestProductDataListCacheKey: generateLatestProductDataListCacheKey,
  generateTweetDataListForProductDetailPageCacheKey: generateTweetDataListForProductDetailPageCacheKey,
  generateProductDetailHTMLCacheKey: generateProductDetailHTMLCacheKey,
}
