const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');

class StatData extends Sequelize.Model {
  // ------------------- Instance Methods -------------------

  // ------------------- Class Methods -------------------
  static selectByStatId(statId) {
    return this.findAll({
      where: {
        statId: statId,
      },
    });
  }

  static selectByProductId(productId) {
    return this.findAll({
      where: {
        productId: productId,
      },
    });
  }
}

StatData.init({
    statId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'stat_id',
      primaryKey: true,
    },
    rank: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: true,
      field: 'rank'
    },
    categoryRank: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: true,
      field: 'category_rank'
    },
    productId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'product_id',
      primaryKey: true,
    },
    tweetCount: {
      type: Sequelize.INTEGER(10).UNSIGNED,
      allowNull: false,
      field: 'tweet_count'
    },
    buzz: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: true,
      defaultValue: '0',
      field: 'buzz'
    },
    isInvalid: {
      type: Sequelize.INTEGER(1),
      allowNull: false,
      defaultValue: '0',
      field: 'is_invalid'
    }
  }, {
    freezeTableName: true,
    underscored: true,
    modelName: 'stat_data',
    timestamps: false,
    sequelize
  }
);

module.exports = StatData;
