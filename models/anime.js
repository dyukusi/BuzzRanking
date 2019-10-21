const appRoot = require('app-root-path');
const __ = require('underscore');
const DBUtil = require(appRoot + '/my_libs/db_util.js');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');

class Anime extends Sequelize.Model {
  // ------------------- Instance Methods -------------------
  getProductName() {
    return this.title;
  }

  // ------------------- Class Methods -------------------
  static selectByProductIds(productIds) {
    return this.findAll({
      where: {
        productId: productIds,
      }
    });
  }

  static selectByProductTypeIds(productTypeIds, options = {}) {
    var where = {
      productTypeId: productTypeIds,
    };

    return this.findAll({
      where: where,
    });
  }

  static bulkInsert(insertObjects) {
    return DBUtil.productBulkInsertUpdateOnDuplicate(Anime, insertObjects);
  }
}

Anime.init({
  productId: {
    type: Sequelize.INTEGER(11).UNSIGNED,
    allowNull: false,
    primaryKey: true,
    field: 'product_id'
  },
  productTypeId: {
    type: Sequelize.INTEGER(11).UNSIGNED,
    allowNull: false,
    primaryKey: true,
    field: 'product_type_id'
  },
  shangrilaId: {
    type: Sequelize.INTEGER(11).UNSIGNED,
    allowNull: false,
    unique: true,
    field: 'shangrila_id'
  },
  year: {
    type: Sequelize.INTEGER(11).UNSIGNED,
    allowNull: false,
    field: 'year'
  },
  cours: {
    type: Sequelize.INTEGER(11).UNSIGNED,
    allowNull: false,
    field: 'cours'
  },
  title: {
    type: Sequelize.STRING(255),
    allowNull: false,
    defaultValue: '',
    field: 'title'
  },
  publicUrl: {
    type: Sequelize.TEXT,
    allowNull: false,
    field: 'public_url'
  },
  ogpImageUrl: {
    type: Sequelize.TEXT,
    allowNull: false,
    field: 'ogp_image_url'
  },
  twitterAccount: {
    type: Sequelize.STRING(255),
    allowNull: false,
    defaultValue: '',
    field: 'twitter_account'
  },
  twitterHashTag: {
    type: Sequelize.STRING(255),
    allowNull: false,
    defaultValue: '',
    field: 'twitter_hash_tag'
  },
  sex: {
    type: Sequelize.INTEGER(11).UNSIGNED,
    allowNull: false,
    field: 'sex'
  },
  sequel: {
    type: Sequelize.INTEGER(11).UNSIGNED,
    allowNull: false,
    field: 'sequel'
  },
  cityCode: {
    type: Sequelize.INTEGER(11).UNSIGNED,
    allowNull: false,
    field: 'city_code'
  },
  cityName: {
    type: Sequelize.STRING(255),
    allowNull: false,
    defaultValue: '',
    field: 'city_name'
  },
  productCompany: {
    type: Sequelize.STRING(255),
    allowNull: false,
    defaultValue: '',
    field: 'product_company'
  },
  updatedAt: {
    type: Sequelize.DATE,
    allowNull: false,
    field: 'updated_at'
  },
  createdAt: {
    type: Sequelize.DATE,
    allowNull: true,
    defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
    field: 'created_at'
  }

  }, {
    freezeTableName: true,
    underscored: true,
    modelName: 'anime',
    sequelize
  }
);

module.exports = Anime;
