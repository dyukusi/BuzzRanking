global.appRoot = require('app-root-path');
global._ = require('underscore');
global.Util = require(appRoot + '/lib/util.js');
global.CacheKeyGenerator = require(appRoot + '/lib/cache_key_generator.js');
global.CacheUtil = require(appRoot + '/lib/cache_util.js');
global.Moment = require('moment');
global.Sequelize = require('sequelize');
global.CONST = Const = require(appRoot + '/lib/const.js');
global.TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');
const ProductUtil = require(appRoot + '/lib/product_util.js');
var Op = Sequelize.Op;

var redis = CacheUtil.getRedisInstance();

(async () => {
  var cacheKey = CacheKeyGenerator.getProductDataListForDebugCacheKey();
  var nowMoment = new Moment();

  var sortedProductIds = _.chain(await getValiditySuspiciousProductModels())
    .sortBy(m => {
      return -1 * new Moment(m.createdAt).unix();
    })
    .map(m => {
      return m.productId;
    })
    .value();

  console.log("fetching tweets...");
  var productDataList = await
    Util.buildProductBundleIdIntoRelatedDataHashByProductBundleIds(sortedProductIds, {
      // excludeInvalidProduct: true,
    });

  redis.set(cacheKey, JSON.stringify(productDataList));

  console.log("cached product list for debug!! cache key: " + cacheKey);
})();

// NOTE: except 0 status
async function getValiditySuspiciousProductModels() {
  console.log("----- Suspicious Products -----");
  var productModels = await ProductUtil.selectProductModels({
    validityStatus: {
      [Op.notIn]: _.flatten([CONST.VALID_STATUS_IDS, CONST.VALIDITY_STATUS_NAME_TO_ID_HASH.INVALID]),
    },
  });

  return productModels;
}
