const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');

class WebService extends Sequelize.Model {
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

  static selectByProductTypeIds(productTypeIds, options) {
    var where = {
      productTypeId: productTypeIds,
    };

    return this.findAll({
      where: where,
    });
  }
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
    }
  }, {
    freezeTableName: true,
    underscored: true,
    modelName: 'web_service',
    timestamps: false,
    sequelize
  }
);

module.exports = WebService;
