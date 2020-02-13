const appRoot = require('app-root-path');
const __ = require('underscore');
const express = require('express');
const router = express.Router();
const CONST = Const = require(appRoot + '/lib/const.js');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Op = Sequelize.Op;
const Util = require(appRoot + '/lib/util.js');
const Config = require('config');
const Tweet = require(appRoot + '/models/tweet');
const Moment = require('moment');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');
const TweetCountLog = require(appRoot + '/models/tweet_count_log');
const ProductTweetStat = require(appRoot + '/models/product_tweet_stat');
const ProductUtil = require(appRoot + '/lib/product_util.js');
const CacheUtil = require(appRoot + '/lib/cache_util.js');
const ProductBundle = require(appRoot + '/models/product_bundle');
const Ranking = require(appRoot + '/models/ranking.js');
const ReleaseControl = require(appRoot + '/models/release_control.js');
const GoogleAnalyticsAPI = require(appRoot + '/lib/google_analytics_api.js');

function isAdmin(req, res, next) {
  var email = req.user ? req.user.email : null;

  if (email == Config.admin_gmail_address) {
    return next();
  } else {
    res.redirect('/auth');
  }
}

router.get('/', isAdmin, async function (req, res, next) {
  var redis = CacheUtil.getRedisInstance();
  var cacheKeys = __.sortBy(await redis.keys('*'));

  var cacheInfoList = [];
  for (var i = 0; i < cacheKeys.length; i++) {
    var key = cacheKeys[i];
    var value = await redis.get(key);
    var byte = getBinarySize(value);
    cacheInfoList.push({
      key: key,
      size: byte,
    });
  }

  cacheInfoList = __.sortBy(cacheInfoList, cacheInfo => {
    return -1 * +cacheInfo.size;
  });

  res.render('admin', {
    cacheInfoList: cacheInfoList,
  })
});

router.get('/product_list', isAdmin, async function (req, res, next) {
  var qs = req.query;
  var productIds = qs.product_ids.split(',');

  var productModels = await ProductUtil.selectProductModels({
    productId: productIds,
  });

  var productIdIntoProductModelHash = __.indexBy(productModels, m => {
    return m.productId;
  });

  var originalOrderedProductModels = (() => {
    var result = [];

    __.each(productIds, productId => {
      var productModel = productIdIntoProductModelHash[productId];
      if (productModel) {
        result.push(productModel);
      }
    });

    return result;
  })();

  return res.render('product_list_for_admin', {
    productModels: originalOrderedProductModels,
  });
});

router.get('/bundle_search', isAdmin, async function (req, res, next) {
  var qs = req.query;
  var searchWord = qs.search_word;

  console.log("search word: " + searchWord);

  if (!searchWord || searchWord.length <= 2) {
    throw new Error('invalid search word: ' + searchWord);
    return;
  }

  // var similarProductBundleRows = await sequelize.query(
  //   "SELECT id AS productBundleId, name, MATCH (name) AGAINST(:searchWord) AS score FROM product_bundle WHERE MATCH(name) AGAINST(:searchWord) ORDER BY score DESC LIMIT 100;",
  //   {
  //     replacements: {
  //       searchWord: searchWord,
  //     },
  //     type: Sequelize.QueryTypes.SELECT,
  //   }
  // );

  var productBundleModels = await ProductBundle.findAll({
    where: {
      name: {
        [Op.like]: '%' + searchWord + '%',
      },
    }
  });

  console.log(productBundleModels.length + " bundles were detected");

  var productBundleIds = __.map(productBundleModels, m => {
    return m.id;
  });

  return res.redirect('/?category=all&debug_product_bundle_ids=' + productBundleIds.join(','));
});

router.post('/raw_select_sql', isAdmin, async function (req, res, next) {
  var q = req.body;
  var sql = q.sql;

  var rows = await sequelize.query(sql, {
    type: Sequelize.QueryTypes.SELECT,
  });

  var productBundleIds = __.chain(rows)
    .pluck('productBundleId')
    .first(500)
    .value();

  console.log(productBundleIds.length + " bundles were detected");

  var url = '/?category=all&debug_product_bundle_ids=' + productBundleIds.join(',');

  return res.send({
    url: url,
  });
});

router.post('/raw_select_sql_for_product', isAdmin, async function (req, res, next) {
  var q = req.body;
  var sql = q.sql;

  var rows = await sequelize.query(sql, {
    type: Sequelize.QueryTypes.SELECT,
  });

  var productIds = __.chain(rows)
    .pluck('productId')
    .first(500)
    .value();

  console.log(productIds.length + " products were detected");

  var url = '/admin/product_list?product_ids=' + productIds.join(',');

  return res.send({
    url: url,
  });
});

router.get('/not_protected_in_pv_order', isAdmin, async function (req, res, next) {
  var productBundleIdIntoPvHash = await GoogleAnalyticsAPI.getProductBundleIdIntoPvInWeekHash();
  var productBundleIds = __.keys(productBundleIdIntoPvHash);

  var productBundleModels = await ProductBundle.findAll({
    where: {
      id: productBundleIds,
    },
  });

  var targetProductBundleModels = __.filter(productBundleModels, m => {
    return !m.isProtected();
  });

  var targetProductBundleIds = __.chain(targetProductBundleModels)
    .sortBy(m => {
      var pv = productBundleIdIntoPvHash[m.id];
      return -1 * pv; // DESC
    })
    .map(m => {
      return m.id;
    })
    .value();

  console.log(targetProductBundleIds.length + " bundles were detected");

  return res.redirect('/?category=all&debug_product_bundle_ids=' + targetProductBundleIds.join(','));
});

router.get('/select_by_validity_status', isAdmin, async function (req, res, next) {
  var qs = req.query;
  var validity_status_id = qs.validity_status_id;
  var productBundleModels = await ProductBundle.findAll({
    where: {
      validityStatus: validity_status_id,
    }
  });
  var productBundleIds = __.pluck(productBundleModels, 'id');
  productBundleIds = __.first(productBundleIds, 500);

  console.log(productBundleIds.length + " bundles were detected");

  return res.redirect('/?category=all&debug_product_bundle_ids=' + productBundleIds.join(','));
});

router.get('/select_by_product_table_name', isAdmin, async function (req, res, next) {
  var qs = req.query;
  var productTableName = qs.product_table_name;
  var shouldReviewValidityStatus = !!qs.should_review_validity_status;

  var tableNameIntoModelClassHash = __.indexBy(ProductUtil.getAllProductModelClass(), productModelClass => {
    return productModelClass.name;
  });

  var productModelClass = tableNameIntoModelClassHash[productTableName];
  var productModels = await productModelClass.findAll({});
  var productBundleIds = __.chain(productModels)
    .filter(m => {
      return !!m.productBundleId;
    })
    .pluck('productBundleId')
    .value();

  var optionalWhere = {};
  if (shouldReviewValidityStatus) {
    console.log("filterling by SHOULD_REVIEW_VALIDITY_STATUS_IDS");
    optionalWhere = __.extend(optionalWhere, {
      validityStatus: CONST.SHOULD_REVIEW_VALIDITY_STATUS_IDS,
    });
  }

  var productBundleModels = await ProductBundle.findAll({
    where: __.extend({
      id: productBundleIds,
    }, optionalWhere)
  });

  var targetProductBundleIds = __.chain(productBundleModels)
    .filter(m => {
      return m.isValid();
    })
    .pluck('id')
    .first(500)
    .value();

  console.log(targetProductBundleIds.length + " bundles were detected");

  return res.redirect('/?category=all&debug_product_bundle_ids=' + targetProductBundleIds.join(','));
});

// router.get('/protected_bundles_having_candidate_child_products', isAdmin, async function (req, res, next) {
//   var qs = req.query;
//   var productBundleModels = await ProductBundle.findAll({
//     where: {
//       validityStatus: CONST.VALIDITY_STATUS_NAME_TO_ID_HASH.PROTECTED,
//     }
//   });
//
//   var targetProductBundleIds = [];
//   for (var i = 0; i < productBundleModels.length; i++) {
//     var productBundleModel = productBundleModels[i];
//     var productModels = await ProductUtil.selectProductModels({
//       title: {
//         [Op.like]: '%' + productBundleModel.name + '%',
//       },
//       productBundleId: {
//         [Op.or]: [
//           {
//             [Op.ne]: productBundleModel.id,
//           },
//           {
//             [Op.eq]: null,
//           }
//         ],
//       },
//     });
//
//     if (productModels.length) {
//       targetProductBundleIds.push(productBundleModel.id);
//     }
//   }
//
//   console.log(targetProductBundleIds.length + " bundles were detected");
//
//   return res.redirect('/?category=all&debug_product_bundle_ids=' + targetProductBundleIds.join(','));
// });

// router.get('/ranked_bundles_without_protected', isAdmin, async function (req, res, next) {
//   var qs = req.query;
//   var latestReleaseControlModel = await ReleaseControl.selectLatest();
//   var targetDateStr = latestReleaseControlModel.getMoment().format('YYYY-MM-DD');
//   var rankingModels = __.chain(await Ranking.findAll({
//     where: {
//       date: targetDateStr,
//       type: CONST.RANKING_TYPE_NAME_TO_ID_HASH.BUZZ,
//       productTypeBundleId: CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID_HASH.ALL,
//       productTypeId: CONST.PRODUCT_TYPE_NAME_TO_ID_HASH.ALL,
//     },
//   }))
//     .sortBy(rankingModel => {
//       return rankingModel.rank; // ASC
//     })
//     .value();
//
//   var productBundleIds = __.pluck(rankingModels, 'productBundleId');
//
//   var targetProductBundleIds = [];
//   for (var i = 0; i < productBundleIds.length; i++) {
//     var productBundleId = productBundleIds[i];
//     var productData = await ProductUtil.loadProductDataByProductBundleId(productBundleId);
//     if (!productData.productBundleModel.isProtected()) {
//       targetProductBundleIds.push(productBundleId);
//     }
//   }
//
//   console.log(targetProductBundleIds.length + " bundles were detected");
//
//   return res.redirect('/?category=all&debug_product_bundle_ids=' + targetProductBundleIds.join(','));
// });

router.get('/sort_by_child_product_num', isAdmin, async function (req, res, next) {
  var qs = req.query;

  var productModelClassList = ProductUtil.getAllProductModelClass();
  var sql = 'SELECT count(*) AS count, temp.product_bundle_id FROM ('
    + __.map(productModelClassList, productModelClass => {
      return 'SELECT product_bundle_id FROM ' + productModelClass.name;
    }).join(' UNION ALL ') + ') AS temp WHERE temp.product_bundle_id IS NOT NULL GROUP BY product_bundle_id ORDER BY count DESC;';

  var rows = await sequelize.query(sql, {
    type: Sequelize.QueryTypes.SELECT,
  });

  var productBundleIds = __.pluck(rows, 'product_bundle_id');

  var productBundleModels = await ProductBundle.findAll({
    where: {
      id: productBundleIds,
      validityStatus: {
        [Op.not]: [CONST.VALIDITY_STATUS_NAME_TO_ID_HASH.PROTECTED, CONST.VALIDITY_STATUS_NAME_TO_ID_HASH.INVALID],
      },
    },
  });

  var targetProductBundleIds = (() => {
    var isTargetPBID = __.indexBy(__.pluck(productBundleModels, 'id'), pid => {
      return pid;
    });

    return __.filter(productBundleIds, pbid => {
      return isTargetPBID[pbid];
    });
  })();

  targetProductBundleIds = __.first(targetProductBundleIds, 300);

  return res.redirect('/?category=all&debug_product_bundle_ids=' + targetProductBundleIds.join(','));
});


router.post('/update_product_bundle_validity_status', isAdmin, async function (req, res, next) {
  var q = req.body;
  var productBundleId = q.productBundleId;
  var status = q.status;

  var productBundleModel = await ProductBundle.findOne({
    where: {
      id: productBundleId,
    },
  });

  var updatedProductBundleModel = await productBundleModel.update({
    validityStatus: status,
  });

  res.send({
    result: true,
  });
});

router.post('/update_product_validity_status', isAdmin, async function (req, res, next) {
  var q = req.body;
  var productId = q.productId;
  var status = q.status;

  var productModel = (await ProductUtil.selectProductModels({
    productId: productId,
  }))[0];

  var updatedProductModel = await productModel.update({
    validityStatus: status,
  });

  res.send({
    result: true,
  });
});


router.post('/make_product_become_independent', isAdmin, async function (req, res, next) {
  var q = req.body;
  var productId = q.productId;
  var productBundleName = q.productBundleName;

  var result = await ProductUtil.makeProductBecomeIndependent(productId, productBundleName);

  res.send({
    result: true,
  });
});

// router.post('/re_evaluate_belonged_product_bundle', isAdmin, async function (req, res, next) {
//   var q = req.body;
//   var productId = q.productId;
//
//   var productModel = (await ProductUtil.selectProductModels({
//     productId: productId,
//   }))[0];
//
//   var formattedProductName = Util.formatProductName(productModel.getProductName());
//
//   var newParentProductBundleId = (await ProductUtil.retrieveRelatedProductBundleIds(formattedProductName))[0];
//
//   if (!newParentProductBundleId) {
//     throw new Error('could not find new parent. formatName: ' + formattedProductName + ' productId: ' + productId);
//   }
//
//   var productBundleModel = await ProductBundle.findOne({
//     where: {
//       id: newParentProductBundleId,
//     }
//   });
//
//   res.send({
//     productBundleId: productBundleModel.id,
//     productBundleName: productBundleModel.name,
//     validityStatus: productBundleModel.validityStatus,
//   });
// });

router.post('/update_belonged_product_bundle', isAdmin, async function (req, res, next) {
  var q = req.body;
  var productId = q.productId;
  var productBundleId = q.productBundleId;

  await ProductUtil.updateBelongTargetProductBundle(productId, productBundleId);

  console.log("update_belonged_product_bundle finished!");

  res.send({
    result: true,
  });
});


router.post('/initialize_product_bundle', isAdmin, async function (req, res, next) {
  var q = req.body;
  var productBundleId = +q.productBundleId;

  if (!productBundleId) {
    return res.send({
      result: false,
    });
  }

  var productBundleModel = await ProductBundle.findOne({
    where: {
      id: productBundleId,
    },
  });

  await productBundleModel.update({
    lastTweetSearchedAt: null,
  });

  await Tweet.destroy({
    where: {
      productBundleId: productBundleId,
    }
  });

  await TweetCountLog.destroy({
    where: {
      productBundleId: productBundleId,
    },
  });

  await ProductTweetStat.destroy({
    where: {
      productBundleId: productBundleId,
    },
  });

  console.log("initialized product bundle: " + productBundleId);

  return res.send({
    result: true,
  });
});

router.post('/update_alt_search_word_validity_status', isAdmin, async function (req, res, next) {
  var q = req.body;
  var productId = q.productId;
  var status = q.status;
  var searchWord = q.searchWord;

  var altSearchWordModel = await TwitterAlternativeSearchWord.findOne({
    where: {
      productId: productId,
      searchWord: searchWord,
    },
  });

  var updatedModel = await altSearchWordModel.update({
    validityStatus: status,
  })

  res.send({
    result: true,
  });
});

router.post('/enable_is_invalid_tweet_flag', isAdmin, async function (req, res, next) {
  var q = req.body;
  var updatedTweetModel = await Tweet.updateIsInvalid(q.id, true);

  res.send({
    result: true,
  });
});

router.post('/delete_cache', isAdmin, function (req, res, next) {
  var q = req.body;
  var key = q.key;

  var redis = CacheUtil.getRedisInstance();
  redis.del(key);
  console.log("delete cache. key: " + key);

  res.send({
    result: true,
  });
});

router.post('/update_product_bundle_name', isAdmin, async function (req, res, next) {
  var q = req.body;
  var productBundleId = q.productBundleId;
  var productBundleName = q.productBundleName;

  if (!productBundleName) {
    throw new Error('failed to get new product bundle id or name. id: ' + productBundleId + ' name: ' + productBundleName);
  }

  var productBundleModel = await ProductBundle.findOne({
    where: {
      id: productBundleId,
    },
  });

  var updatedProductBundleModel = await productBundleModel.update({
    name: productBundleName,
  });

  res.send({
    result: true,
  });
});

router.post('/merge_products', isAdmin, async function (req, res, next) {
  var q = req.body;
  var productBundleId = q.productBundleId;
  var productIds = JSON.parse(q.productIds);

  if (!productBundleId || __.isEmpty(productIds)) {
    throw new Error('failed to get product bundle id or product ids. bundleId: ' + productBundleId + ' productIds: ' + productIds);
  }

  for (var i = 0; i < productIds.length; i++) {
    var productId = productIds[i];
    await ProductUtil.updateBelongTargetProductBundle(productId, productBundleId);
  }

  res.send({
    result: true,
  });
});

function getBinarySize(string) {
  return Buffer.byteLength(string, 'utf8');
}

module.exports = router;
