const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const ProductBase = require(appRoot + '/models/product_base');

class WebService extends ProductBase {
  // ------------------- Instance Methods -------------------

  // ------------------- Class Methods -------------------
}

WebService.init({
    productId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: 'product_id'
    },
    productTypeId: {
      type: Sequelize.INTEGER(11),
      allowNull: true,
      field: 'product_type_id'
    },
    title: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'title'
    },
    affiliateHtml: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'affiliate_html'
    },
    memo: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'memo'
    },
    validityStatus: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'validity_status'
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      field: 'created_at'
    },
  }, {
    freezeTableName: true,
    underscored: true,
    modelName: 'web_service',
    timestamps: false,
    sequelize
  }
);

module.exports = WebService;
