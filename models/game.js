const appRoot = require('app-root-path');
const __ = require('underscore');
const DBUtil = require(appRoot + '/my_libs/db_util.js');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const ProductBase = require(appRoot + '/models/product_base');

class Game extends ProductBase {
  // ------------------- Instance Methods -------------------

  // ------------------- Class Methods -------------------
}

Game.init({
    productId: {
      type: Sequelize.INTEGER(10).UNSIGNED,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: 'product_id'
    },
    productTypeId: {
      type: Sequelize.INTEGER(10).UNSIGNED,
      allowNull: false,
      field: 'product_type_id'
    },
    janCode: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      unique: true,
      field: 'jan_code'
    },
    title: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'title'
    },
    titleKana: {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: '',
      field: 'title_kana'
    },
    makerCode: {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: '',
      field: 'maker_code'
    },
    caption: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'caption'
    },
    rakutenAffiliateItemUrl: {
      type: Sequelize.TEXT,
      allowNull: false,
      field: 'rakuten_affiliate_item_url'
    },
    imageUrlBase: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'image_url_base'
    },
    genreId: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'genre_id'
    },
    saleDateStr: {
      type: Sequelize.STRING(30),
      allowNull: false,
      defaultValue: '',
      field: 'sale_date_str'
    },
    saleDate: {
      type: Sequelize.DATEONLY,
      allowNull: false,
      field: 'sale_date'
    },
    validityStatus: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'validity_status'
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      field: 'updated_at'
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      field: 'created_at'
    }
  }, {
    freezeTableName: true,
    underscored: true,
    modelName: 'game',
    sequelize
  }
);

module.exports = Game;
