const appRoot = require('app-root-path');
const _ = require('underscore');
const CONST = require(appRoot + '/lib/const.js');
const ProductUtil = require(appRoot + '/lib/product_util.js');
const sprintf = require('sprintf-js').sprintf;
const ProductBundle = require(appRoot + '/models/product_bundle');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Op = Sequelize.Op;
const DBUtil = require(appRoot + '/lib/db_util.js');
const Tweet = require(appRoot + '/models/tweet');

(async () => {
  await freeProductsBelongingVoidBundle();
  await findProductsBelongingNullWithValidStatusAndSearchAndBelongParent();
  await findAloneProductBundleAndDeleteThem();
  // await findAndAggregateSeparatedProductBundles();
  await findTargetEmptyBundleTweetAndDeleteThem();

  console.log('--- ALL PROCESS DONE ---');
})();

async function findTargetEmptyBundleTweetAndDeleteThem() {
  var rows = await sequelize.query(
    'SELECT DISTINCT product_bundle_id FROM tweet WHERE product_bundle_id NOT IN (SELECT id FROM product_bundle)', {
      type: Sequelize.QueryTypes.SELECT,
    }
  );

  var productBundleIds = _.pluck(rows, 'product_bundle_id');

  await Tweet.destroy({
    where: {
      productBundleId: productBundleIds,
    },
  });

  console.log(arguments.callee.name + " finished");
}

async function findAndAggregateSeparatedProductBundles() {
  var productBundleModels = await ProductBundle.findAll({
    where: {
      // id: 56836,
      validityStatus: CONST.VALID_STATUS_IDS,
    },
    order: [
      ['createdAt', 'ASC'],
    ],
  });

  for (var i = 0; i < productBundleModels.length; i++) {
    if (i % 100 == 0) {
      console.log(i + " / " + productBundleModels.length);
    }

    var productBundleModel = productBundleModels[i];

    if (!productBundleModel.isProtected() && productBundleModel.name.length < 4) {
      console.log('parent bundle name length should be more than 4. skipped: ' + productBundleModel.name);
      continue;
    }

    var rows = await sequelize.query(
      sprintf(
        'SELECT * FROM product_bundle WHERE id != %(selfProductBundleId)d AND validity_status IN (:validityStatusIds) AND name LIKE "%(productBundleName)s%%"',
        {
          selfProductBundleId: productBundleModel.id,
          validityStatusIds: CONST.CAN_JOIN_VALIDITY_STATUS_IDS,
          productBundleName: productBundleModel.name,
        }
      ), {
        replacements: {},
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    if (_.isEmpty(rows)) {
      continue;
    }

    var toProductBundleId = productBundleModel.id; // parent
    var fromProductBundleIds = _.pluck(rows, 'id'); // child

    var productModels = await ProductUtil.selectProductModels({
      productBundleId: fromProductBundleIds,
    });

    console.log("■ " + productBundleModel.name + ' (bId: ' + productBundleModel.id + ')');
    for (var j = 0; j < productModels.length; j++) {
      var productModel = productModels[j];
      console.log("  - " + productModel.getProductName() + ' (pId: ' + productModel.productId + ' oldBId: ' + productModel.productBundleId + ')');
      await ProductUtil.updateBelongTargetProductBundle(productModel.productId, toProductBundleId);
    }
  }

  console.log(arguments.callee.name + " finished");
}

async function findAloneProductBundleAndDeleteThem() {
  var productModelClassList = ProductUtil.getAllProductModelClass();

  var selectAloneProductBundleIdSql = 'SELECT id FROM product_bundle WHERE id NOT IN '
    + _.map(productModelClassList, productModelClass => {
      return '(SELECT product_bundle_id FROM ' + productModelClass.name + ' WHERE product_bundle_id IS NOT NULL)';
    }).join(' AND id NOT IN ');

  var rows = await sequelize.query(selectAloneProductBundleIdSql, {
    type: Sequelize.QueryTypes.SELECT,
  });

  var productBundleIds = _.pluck(rows, 'id');

  if (_.isEmpty(productBundleIds)) {
    console.log('not found alone product bundle. skipping this process.');
    return;
  }

  console.log(productBundleIds.length + ' alone bundles found. deleting them...');

  await ProductBundle.destroy({
    where: {
      id: productBundleIds,
    },
  });

  console.log(arguments.callee.name + " finished");
}


async function findProductsBelongingNullWithValidStatusAndSearchAndBelongParent() {
  var productModels = await ProductUtil.selectValidProductModels({
    productBundleId: null,
  });

  console.log(productModels.length + " alone products are found. finding or creating bundle...");

  for (var i = 0; i < productModels.length; i++) {
    var productModel = productModels[i];
    console.log(i + " / " + productModels.length + " " + productModel.getProductName());

    await sequelize.transaction(async function (tx) {
      await DBUtil.findAndLinkWithBundleCreateIfNeed(productModel, {
        transaction: tx,
      });
    });
  }

  console.log(arguments.callee.name + " finished");
}

async function freeProductsBelongingVoidBundle() {
  var fetchProductBundleIdsPromises = _.map(ProductUtil.getAllProductModelClass(), productModelClass => {
    var sql = sprintf(
      'SELECT DISTINCT product_bundle_id FROM %(productTableName)s WHERE product_bundle_id NOT IN (SELECT id FROM product_bundle);',
      {
        productTableName: productModelClass.name,
      }
    );

    var promise = sequelize.query(sql,
      {
        replacements: {},
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    return promise;
  });

  var sqlResults = await Promise.all(fetchProductBundleIdsPromises);
  var productBundleIds = _.chain(sqlResults)
    .flatten()
    .pluck('product_bundle_id')
    .value();

  var productBundleModels = await ProductBundle.findAll({
    where: {
      id: productBundleIds,
    }
  });

  if (!_.isEmpty(productBundleModels)) {
    throw new Error('although we searched products belonging void bundle but we found the bundle...what happened?!');
  }

  var productModels = await ProductUtil.selectProductModels({
    productBundleId: productBundleIds,
  });

  for (var i = 0; i < productModels.length; i++) {
    var productModel = productModels[i];
    await productModel.update({
      productBundleId: null,
    });
  }

  console.log(productModels.length + ' products are free from void bundle.');
  console.log(arguments.callee.name + " finished");
}
