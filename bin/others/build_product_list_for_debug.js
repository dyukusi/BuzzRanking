global.appRoot = require('app-root-path');
global._ = require('underscore');
global.Util = require(appRoot + '/my_libs/util.js');
global.cacheUtil = require(appRoot + '/my_libs/cache_util.js');
global.Moment = require('moment');
global.Sequelize = require('sequelize');
global.CONST = Const = require(appRoot + '/my_libs/const.js');
global.TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');
var Op = Sequelize.Op;

var redis = cacheUtil.createRedisInstance();

(async () => {
  var cacheKey = cacheUtil.getProductDataListForDebugCacheKey();
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
    Util.buildProductDataListObject(sortedProductIds, {
      // excludeInvalidProduct: true,
      tweetSelectOptions: {
        excludeInvalidTweets: true,
        // since: nowMoment.subtract(3, 'day').format("YYYY-MM-DD"),
      },
    });

  redis.set(cacheKey, JSON.stringify(productDataList));

  console.log("cached product list for debug!! cache key: " + cacheKey);
})();

// NOTE: except 0 status
async function getValiditySuspiciousProductModels() {
  console.log("----- Suspicious Products -----");
  var productModels = await Util.selectProductModels({
    validityStatus: {
      [Op.notIn]: _.flatten([CONST.VALID_STATUS_IDS, CONST.VALIDITY_STATUS_NAME_TO_ID.invalid]),
    },
  });

  return productModels;
}
