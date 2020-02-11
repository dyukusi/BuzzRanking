const appRoot = require('app-root-path');
const __ = require('underscore');
const CONST = require(appRoot + '/lib/const.js');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Util = require(appRoot + '/lib/util.js');
const ProductBundle = require(appRoot + '/models/product_bundle');
const ProductUtil = require(appRoot + '/lib/product_util.js');
const Seq = require(appRoot + '/models/seq');

// NOTE: this method only works with BeforeInsert trigger for sequence productId
async function insertProductsUpdateOnDuplicate(ProductClass, dataList) {
  // return Promise.all(__.map(dataList, data => {
  //   insertProductUpdateOnDuplicate(ProductClass, data);
  // }));
  var productModels = [];

  for (var i = 0; i < dataList.length; i++) {
    var data = dataList[i];
    productModels.push(await insertProductUpdateOnDuplicate(ProductClass, data));
  }

  return productModels;
}

// NOTE: this method only works with BeforeInsert trigger for sequence productId
function insertProductUpdateOnDuplicate(ProductClass, data) {
  if (data.productId) {
    throw new Error('product id should not be set by manually! see BeforeInsert trigger');
  }

  return sequelize.transaction(async function (tx) {
    var uniqueKeyColumnName = __.map(__.values(ProductClass.uniqueKeys), obj => {
      return obj.column;
    })[0];

    if (__.isEmpty(uniqueKeyColumnName)) {
      throw new Error('ERROR: product table must have at least one unique key column');
    }

    // checking whether new product or already existed
    var productModel = await ProductClass.findOne({
      where: {
        [uniqueKeyColumnName]: data[uniqueKeyColumnName],
      },
    });

    var isNewProduct = __.isEmpty(productModel);

    // --- UPDATE ---
    if (!isNewProduct) {
      var updatedProductModel = await productModel.update(data, {
        transaction: tx,
      });

      return updatedProductModel; // COMMIT
    }

    // --- INSERT ---
    var newProductId = await Seq.getNewProductId(tx);

    data.productId = newProductId;
    data.validityStatus = CONST.VALIDITY_STATUS_NAME_TO_ID_HASH.TEMP;

    var createdProductModel = await ProductClass.create(data, {
      transaction: tx,
    });

    await findAndLinkWithBundleCreateIfNeed(createdProductModel, {
      transaction: tx,
    })

    return createdProductModel; // COMMIT
  });
}

async function findAndLinkWithBundleCreateIfNeed(productModel, options) {
  var options = options || {};
  var tx = options.transaction;

  var formattedProductName = Util.formatProductName(productModel.getProductName());
  var relatedProductBundleId = (await ProductUtil.retrieveRelatedProductBundleIds(formattedProductName))[0];

  // link with existing product bundle
  if (relatedProductBundleId) {
    await productModel.update({
      productBundleId: relatedProductBundleId,
      validityStatus: CONST.VALIDITY_STATUS_NAME_TO_ID_HASH.NORMAL,
    }, {
      transaction: tx,
    });

    console.log(productModel.productBundleId);

    var productBundleModel = await ProductBundle.findOne({
      where: {
        id: relatedProductBundleId,
      },
      transaction: tx,
    });

    // adjust product bundle name if not protected
    if (!productBundleModel.isProtected()) {
      var productModels = await ProductUtil.selectProductModels({
        productBundleId: relatedProductBundleId,
      }, {
        transaction: tx,
      });

      var productNames = __.map(productModels, m => {
        return Util.formatProductName(m.getProductName());
      });

      var commonName = Util.multiLCS(productNames);
      var isSuspiciousCommonName = await Util.isSuspiciousTitle(commonName);

      if (isSuspiciousCommonName) {
        await productModel.update({
          validityStatus: CONST.VALIDITY_STATUS_NAME_TO_ID_HASH.SUSPICIOUS_BY_ADDING_RELATED_PRODUCT,
        }, {
          transaction: tx,
        });

      } else {
        await productBundleModel.update({
          name: commonName,
        }, {
          transaction: tx,
        });
      }
    }

    return;
  }

  // need to create new bundle record
  var validityStatusForProduct = await Util.isSuspiciousTitle(formattedProductName) ?
    CONST.VALIDITY_STATUS_NAME_TO_ID_HASH.SUSPICIOUS_BY_MECAB_ANALYSIS :
    CONST.VALIDITY_STATUS_NAME_TO_ID_HASH.NORMAL;

  var newProductBundleId = productModel.productId;

  await productModel.update({
    productBundleId: newProductBundleId,
    validityStatus: validityStatusForProduct,
  }, {
    transaction: tx,
  });

  var createdProductBundleModel = await ProductBundle.create({
    id: newProductBundleId,
    name: formattedProductName,
    isRankedWithoutBuzzThreshold: 0, // false
    validityStatus: validityStatusForProduct,
  }, {
    transaction: tx,
  });

  return;
}

module.exports = {
  insertProductUpdateOnDuplicate,
  insertProductsUpdateOnDuplicate,

  findAndLinkWithBundleCreateIfNeed,
};
