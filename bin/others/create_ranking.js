// node create_ranking.js ProductTypeId rankingDate tweetSince tweetUntil productSince productUntil
const appRoot = require('app-root-path');
const _ = require('underscore');
const Ranking = require(appRoot + '/models/ranking.js');
const ProductUtil = require(appRoot + '/lib/product_util.js');
const ProductTweetStat = require(appRoot + '/models/product_tweet_stat');

const Moment = require('moment');
const CONST = require(appRoot + '/lib/const.js');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

var targetDate = process.argv[2];
if (_.isEmpty(process.argv[2])) {
  throw new Error('pls specify args. node create_ranking.js 2020-01-07');
}
var targetMoment = new Moment(targetDate);

console.log('target ranking date: ' + targetDate);

(async () => {
  console.log("calculating ranking...");
  // var insertObjectsForBuzzRanking = await createInsertObjectsForBuzzRanking();
  var insertObjectsForBuzzRankingDX = await createInsertObjectsForBuzzRankingDX();

  var allInsertObjects = _.flatten([
    // insertObjectsForBuzzRanking,
    insertObjectsForBuzzRankingDX,
  ]);

  console.log("deleting " + targetDate + " records if need");
  await Ranking.destroy({
    where: {
      date: targetMoment.format('YYYY-MM-DD'),
    }
  });

  console.log("creating ranking records...");
  var rankingModels = await Ranking.bulkCreate(allInsertObjects);

  console.log("done!");
  process.exit(0);
})();

async function createInsertObjectsForBuzzRankingDX() {
  var productTweetStatModels = await ProductTweetStat.findAll({
    where: {
      date: targetMoment.format('YYYY-MM-DD'),
      buzz: {
        [Op.gte]: CONST.THRESHOLD_BUZZ_FOR_RANK_IN,
      },
    },
  });

  var productBundleIdIntoProductTweetStatModel = _.indexBy(productTweetStatModels, m => {
    return m.productBundleId;
  })

  var productBundleIds = _.map(productTweetStatModels, m => {
    return m.productBundleId;
  });

  var productDataList = [];
  for (var i = 0; i < productBundleIds.length; i++) {
    if (i % 100 == 0) {
      console.log(i + '/' + productBundleIds.length);
    }

    var productBundleId = productBundleIds[i];
    var productData = await ProductUtil.loadProductDataByProductBundleId(productBundleId, {
      ignoreCache: true,
    });
    productDataList.push(productData);
  }

  // var loadProductDataPromises = _.map(productBundleIds, productBundleId => {
  //   return ProductUtil.loadProductDataByProductBundleId(productBundleId, {
  //     ignoreCache: true,
  //   });
  // });
  //
  // var productDataList = await Promise.all(loadProductDataPromises);

  console.log("create buzz ranking");

  var createInsertObjects = function (targetProductTypeBundleId, targetProductTypeId) {
    if (targetProductTypeBundleId == CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID_HASH.ALL && targetProductTypeId != CONST.PRODUCT_TYPE_NAME_TO_ID_HASH.ALL) {
      throw new Error('target product type id should be ALL too when product type bundle id is ALL');
    }

    var targetProductDataList = [];
    _.each(productDataList, (productData) => {
      var hasTargetProductTypeBundleProduct = _.any(productData.productModels, productModel => {
        var productTypeId = productModel.productTypeId;
        var productTypeBundleId = CONST.PRODUCT_TYPE_ID_TO_BELONGED_PRODUCT_TYPE_BUNDLE_ID[productTypeId];
        if (targetProductTypeBundleId == CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID_HASH.ALL) return true;

        if (!productModel.isNewReleasedProductByMoment(targetMoment)) return false;
        if (targetProductTypeBundleId != productTypeBundleId) return false;
        if (targetProductTypeId == CONST.PRODUCT_TYPE_NAME_TO_ID_HASH.ALL) return true;
        return targetProductTypeId == productTypeId;
      });

      if (hasTargetProductTypeBundleProduct) {
        targetProductDataList.push(productData);
      }
    });

    targetProductDataList = _.filter(targetProductDataList, productData => {
      return !!productData.productBundleModel;
    });

    var sortedProductDataList = _.sortBy(targetProductDataList, productData => {
      try {
        var productTweetStatModel = productBundleIdIntoProductTweetStatModel[productData.productBundleModel.id];
        var buzz = productTweetStatModel.buzz;
        return -1 * buzz; // desc order
      } catch(e) {
        console.log(productData.productBundleModel);
        console.log(productData.productModels[0]);
        process.exit(1);
      }
    });

    var rank = -1;
    var previousBuzz = null;
    var insertObjectsForBuzzRanking = [];

    for (let i = 0; i < sortedProductDataList.length; i++) {
      var productData = sortedProductDataList[i];
      var productTweetStatModel = productBundleIdIntoProductTweetStatModel[productData.productBundleModel.id];
      var buzz = productTweetStatModel.buzz;
      if (previousBuzz != buzz) {
        rank = (i + 1);
      }

      insertObjectsForBuzzRanking.push({
        date: targetDate,
        type: Number(CONST.RANKING_TYPE_NAME_TO_ID_HASH.BUZZ),
        productTypeBundleId: Number(targetProductTypeBundleId),
        productTypeId: Number(targetProductTypeId),
        productBundleId: productData.productBundleModel.id,
        rank: Number(rank),
      });

      previousBuzz = buzz;
    }

    return insertObjectsForBuzzRanking;
  };

  var insertObjectsForBuzzRanking = [];
  _.each(_.values(CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID_HASH), productTypeBundleId => {
    var productTypeIds;
    if (productTypeBundleId == CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID_HASH.ALL) {
      productTypeIds = [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH.ALL];
    } else {
      productTypeIds = _.union(
        [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH.ALL],
        CONST.PRODUCT_TYPE_BUNDLE_ID_TO_PRODUCT_TYPE_IDS[productTypeBundleId]
      );
    }

    _.each(productTypeIds, productTypeId => {
      insertObjectsForBuzzRanking.push(createInsertObjects(productTypeBundleId, productTypeId));
    });
  });

  insertObjectsForBuzzRanking = _.chain(insertObjectsForBuzzRanking)
    .flatten()
    .compact()
    .value();

  return insertObjectsForBuzzRanking;
}

async function createInsertObjectsForBuzzRanking() {
  var productTweetStatModels = await ProductTweetStat.findAll({
    where: {
      date: new Moment(targetDate).format('YYYY-MM-DD'),
      buzz: {
        [Op.gte]: CONST.THRESHOLD_BUZZ_FOR_RANK_IN,
      },
    },
  });

  var productBundleIdIntoProductTweetStatModel = _.indexBy(productTweetStatModels, m => {
    return m.productBundleId;
  })

  var productBundleIds = _.map(productTweetStatModels, m => {
    return m.productBundleId;
  });

  var loadProductDataPromises = _.map(productBundleIds, productBundleId => {
    return ProductUtil.loadProductDataByProductBundleId(productBundleId, {
      ignoreCache: true,
    });
  });

  var productDataList = await Promise.all(loadProductDataPromises);

  console.log("create buzz ranking");

  var createInsertObjects = function (targetProductTypeBundleId, targetProductTypeId) {
    if (targetProductTypeBundleId == CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID_HASH.ALL && targetProductTypeId != CONST.PRODUCT_TYPE_NAME_TO_ID_HASH.ALL) {
      throw new Error('target product type id should be ALL too when product type bundle id is ALL');
    }

    var targetProductDataList = [];
    _.each(productDataList, (productData) => {
      var hasTargetProductTypeBundleProduct = _.any(productData.productModels, productModel => {
        var productTypeId = productModel.productTypeId;
        var productTypeBundleId = CONST.PRODUCT_TYPE_ID_TO_BELONGED_PRODUCT_TYPE_BUNDLE_ID[productTypeId];

        if (targetProductTypeBundleId == CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID_HASH.ALL) return true;
        if (targetProductTypeBundleId != productTypeBundleId) return false;

        if (targetProductTypeId == CONST.PRODUCT_TYPE_NAME_TO_ID_HASH.ALL) return true;
        return targetProductTypeId == productTypeId;
      });

      if (hasTargetProductTypeBundleProduct) {
        targetProductDataList.push(productData);
      }
    });

    targetProductDataList = _.filter(targetProductDataList, productData => {
      return !!productData.productBundleModel;
    });

    var sortedProductDataList = _.sortBy(targetProductDataList, productData => {
      try {
        var productTweetStatModel = productBundleIdIntoProductTweetStatModel[productData.productBundleModel.id];
        var buzz = productTweetStatModel.buzz;
        return -1 * buzz; // desc order
      } catch(e) {
        console.log(productData.productBundleModel);
        console.log(productData.productModels[0]);
        process.exit(1);
      }
    });

    var rank = -1;
    var previousBuzz = null;
    var insertObjectsForBuzzRanking = [];

    for (let i = 0; i < sortedProductDataList.length; i++) {
      var productData = sortedProductDataList[i];
      var productTweetStatModel = productBundleIdIntoProductTweetStatModel[productData.productBundleModel.id];
      var buzz = productTweetStatModel.buzz;
      if (previousBuzz != buzz) {
        rank = (i + 1);
      }

      insertObjectsForBuzzRanking.push({
        date: targetDate,
        type: Number(CONST.RANKING_TYPE_NAME_TO_ID_HASH.BUZZ),
        productTypeBundleId: Number(targetProductTypeBundleId),
        productTypeId: Number(targetProductTypeId),
        productBundleId: productData.productBundleModel.id,
        rank: Number(rank),
      });

      previousBuzz = buzz;
    }

    return insertObjectsForBuzzRanking;
  };

  var insertObjectsForBuzzRanking = [];
  _.each(_.values(CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID_HASH), productTypeBundleId => {
    var productTypeIds;
    if (productTypeBundleId == CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID_HASH.ALL) {
      productTypeIds = [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH.ALL];
    } else {
      productTypeIds = _.union(
        [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH.ALL],
        CONST.PRODUCT_TYPE_BUNDLE_ID_TO_PRODUCT_TYPE_IDS[productTypeBundleId]
      );
    }

    _.each(productTypeIds, productTypeId => {
      insertObjectsForBuzzRanking.push(createInsertObjects(productTypeBundleId, productTypeId));
    });
  });

  insertObjectsForBuzzRanking = _.chain(insertObjectsForBuzzRanking)
    .flatten()
    .compact()
    .value();

  return insertObjectsForBuzzRanking;
}
