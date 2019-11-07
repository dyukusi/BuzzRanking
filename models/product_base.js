const appRoot = require('app-root-path');
const __ = require('underscore');
const DBUtil = require(appRoot + '/my_libs/db_util.js');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');

class ProductBase extends Sequelize.Model {
  // ------------------- Instance Methods -------------------
  getProductName() {
    return this.title.trim();
  }

  isValid() {
    return Util.isValidByStatus(this.validityStatus);
  }

  isProtected() {
    return this.validityStatus == Const.VALIDITY_STATUS_NAME_TO_ID.protected;
  }

  getBelongedProductBundleId() {
    return Const.PRODUCT_TYPE_ID_TO_BELONGED_PRODUCT_TYPE_BUNDLE_ID[this.productTypeId];
  }

  getBelongedProductBundleJaName() {
    return Const.PRODUCT_TYPE_BUNDLE_ID_TO_JA_NAME_HASH[this.getBelongedProductBundleId()];
  }

  getProductClassName() {
    return this._modelOptions.name.singular;
  }


  // ------------------- Class Methods -------------------
  static selectByProductIds(productIds) {
    return this.findAll({
      where: {
        productId: productIds,
      }
    });
  }

  static bulkInsert(insertObjects) {
    return DBUtil.productBulkInsertUpdateOnDuplicate(this, insertObjects);
  }
}

module.exports = ProductBase;
