const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');

// status
// 0: is surely invalid product(added by manually)(default value)
// 1: is not surely invalid product. need to distinguish by manual

class InvalidProduct extends Sequelize.Model {
  // ------------------- Instance Methods -------------------

  // ------------------- Class Methods -------------------
  static selectByProductIds(productIds) {
    return this.findAll({
      where: {
        productId: productIds,
      }
    });
  }

  static insert(productId, status) {
    return this.create({
      productId: productId,
      status: status,
    });
  }
}

InvalidProduct.init({
    productId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'product_id',
      primaryKey: true,
    },
    status: {
      type: Sequelize.INTEGER(11),
      allowNull: true,
      defaultValue: '0',
      field: 'status'
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
    modelName: 'invalid_product',
    timestamps: false,
    sequelize
  }
);

module.exports = InvalidProduct;
