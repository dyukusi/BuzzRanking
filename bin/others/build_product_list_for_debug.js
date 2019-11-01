const appRoot = require('app-root-path');
const _ = require('underscore');
const Util = require(appRoot + '/my_libs/util.js');
const cacheUtil = require(appRoot + '/my_libs/cache_util.js');
const Moment = require('moment');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const CONST = require(appRoot + '/my_libs/const.js');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');

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
      excludeInvalidProduct: true,
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
      [Op.notIn]: CONST.VALID_STATUS_IDS,
    },
  });

  return productModels;
}
