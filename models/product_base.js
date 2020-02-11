const appRoot = require('app-root-path');
const Sequelize = require('sequelize');
const Util = require(appRoot + '/lib/util.js');

class ProductBase extends Sequelize.Model {
  // ------------------- Instance Methods -------------------
  getProductName() {
    return this.title.trim();
  }

  getImageURL() {
    throw new Error('implement this');
  }

  getReleaseDateMoment() {
    throw new Error('implement this');
  }

  isNewReleasedProductByMoment() {
    throw new Error('implement this');
  }

  getRakutenAffiliateURL() {
    return this.affiliateItemUrl || this.rakutenAffiliateItemUrl || null;
  }

  isValid() {
    return Util.isValidByStatus(this.validityStatus);
  }

  isProtected() {
    return this.validityStatus == Const.VALIDITY_STATUS_NAME_TO_ID_HASH.PROTECTED;
  }

  getBelongedProductTypeBundleId() {
    return Const.PRODUCT_TYPE_ID_TO_BELONGED_PRODUCT_TYPE_BUNDLE_ID[this.productTypeId];
  }

  getBelongedProductTypeBundleJaName() {
    return Const.PRODUCT_TYPE_BUNDLE_ID_TO_JA_NAME_HASH[this.getBelongedProductTypeBundleId()];
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
}

module.exports = ProductBase;
