const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Op = Sequelize.Op;

// TODO: remove this table
// UPDATE anime SET validity_status = 1 WHERE product_id IN (SELECT product_id FROM invalid_product WHERE status = 1);
// UPDATE anime SET validity_status = 99 WHERE product_id IN (SELECT product_id FROM invalid_product WHERE status = 0);
//
// UPDATE book SET validity_status = 1 WHERE product_id IN (SELECT product_id FROM invalid_product WHERE status = 1);
// UPDATE book SET validity_status = 99 WHERE product_id IN (SELECT product_id FROM invalid_product WHERE status = 0);
//
// UPDATE web_service SET validity_status = 1 WHERE product_id IN (SELECT product_id FROM invalid_product WHERE status = 1);
// UPDATE web_service SET validity_status = 99 WHERE product_id IN (SELECT product_id FROM invalid_product WHERE status = 0);
//
// UPDATE game SET validity_status = 1 WHERE product_id IN (SELECT product_id FROM invalid_product WHERE status = 1);
// UPDATE game SET validity_status = 99 WHERE product_id IN (SELECT product_id FROM invalid_product WHERE status = 0);

// status
// 0: is surely invalid product(added by manually)(default value)
// 1: is not surely invalid product. just suspicious so need to judge by manual
class InvalidProduct extends Sequelize.Model {
  // ------------------- Instance Methods -------------------

  // ------------------- Class Methods -------------------

  // select all without 0 status
  static selectAllSuspicious() {
    return this.findAll({
      where: {
        status: {
          [Op.ne]: 0,
        }
      }
    });
  }

  static selectByProductIds(productIds) {
    return this.findAll({
      where: {
        productId: productIds,
      }
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
      field:
        'status'
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
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
    modelName: 'invalid_product',
    timestamps: false,
    sequelize
  }
);

module.exports = InvalidProduct;
