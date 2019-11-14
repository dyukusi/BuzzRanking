const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Moment = require('moment');
const Q = require('q');

class ProductNum extends Sequelize.Model {
  // ------------------- Instance Methods -------------------

  // ------------------- Class Methods -------------------
  static selectByDateListAndProductTypeId(dateStrList, productTypeId) {
    return this.findAll({
      where: {
        date: dateStrList,
        productTypeId: productTypeId,
      },
    });
  }
}

ProductNum.init({
  date: {
    type: Sequelize.DATEONLY,
    allowNull: false,
    primaryKey: true,
    field: 'date'
  },
  productTypeId: {
    type: Sequelize.INTEGER(11).UNSIGNED,
    allowNull: false,
    field: 'product_type_id'
  },
  count: {
    type: Sequelize.INTEGER(11).UNSIGNED,
    allowNull: false,
    field: 'count'
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
    modelName: 'product_num',
    timestamps: false,
    sequelize
  }
);

module.exports = ProductNum;
