const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Util = require(appRoot + '/lib/util.js');
const CONST = Const = require(appRoot + '/lib/const.js');

class ProductBundle extends Sequelize.Model {
  // ------------------- Instance Methods -------------------
  isValid() {
    return Util.isValidByStatus(this.validityStatus);
  }

  isProtected() {
    return this.validityStatus == CONST.VALIDITY_STATUS_NAME_TO_ID_HASH.PROTECTED;
  }

  // ------------------- Class Methods -------------------
  static async selectById(id) {
    return (await ProductBundle.findAll({
      where: {
        id: id,
      },
    }))[0];
  }

  static async selectByProductBundleIds(productBundleIds) {
    return this.findAll({
      where: {
        id: productBundleIds,
      },
    });
  }

  static async selectValidProductBundleModels(where = {}) {
    var productBundleModels = await this.findAll({
      where: where,
    });

    var validProductBundleModels = __.filter(productBundleModels, m => {
      return m.isValid();
    });

    return validProductBundleModels;
  }
}

ProductBundle.init({
    id: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      primaryKey: true,
      field: 'id'
    },
    name: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'name'
    },
    isRankedWithoutBuzzThreshold: {
      type: Sequelize.INTEGER(1),
      allowNull: false,
      field: 'is_ranked_without_buzz_threshold'
    },
    validityStatus: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'validity_status'
    },
    lastTweetSearchedAt: {
      type: Sequelize.DATE,
      allowNull: true,
      field: 'last_tweet_searched_at'
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      field: 'updated_at'
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      field: 'created_at'
    }
  }, {
    freezeTableName: true,
    underscored: true,
    modelName: 'product_bundle',
    timestamps: false,
    sequelize
  }
);

module.exports = ProductBundle;
