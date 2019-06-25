const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');

class BookCaption extends Sequelize.Model {
  // ------------------- Instance Methods -------------------

  // ------------------- Class Methods -------------------
  static selectByProductIds(productIds) {
    return this.findAll({
      where: {
        productId: productIds,
      }
    });
  }
}

BookCaption.init({
    productId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      primaryKey: true,
      field: 'product_id'
    },
    caption: {
      type: Sequelize.TEXT,
      allowNull: false,
      field: 'caption'
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
    modelName: 'book_caption',
    timestamps: false,
    sequelize
  }
);

module.exports = BookCaption;
