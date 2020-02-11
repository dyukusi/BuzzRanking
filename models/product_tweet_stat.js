const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Moment = require('moment');

class ProductTweetStat extends Sequelize.Model {
  // ------------------- Instance Methods -------------------

  // ------------------- Class Methods -------------------
  static selectByDate(date) {
    return this.findAll({
      where: {
        date: new Moment(date).format('YYYY-MM-DD'),
      },
    });
  }

  static selectByProductBundleId(productBundleId) {
    return this.findAll({
      where: {
        productBundleId: productBundleId,
      },
    });
  }
}

ProductTweetStat.init({
    productBundleId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      primaryKey: true,
      field: 'product_bundle_id'
    },
    date: {
      type: Sequelize.DATE,
      allowNull: false,
      primaryKey: true,
      field: 'date'
    },
    tweetCount: {
      type: Sequelize.INTEGER(11),
      allowNull: false,
      field: 'tweet_count'
    },
    userCount: {
      type: Sequelize.INTEGER(11),
      allowNull: false,
      primaryKey: true,
      field: 'user_count'
    },
    buzz: {
      type: Sequelize.INTEGER(11),
      allowNull: false,
      field: 'buzz'
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
    modelName: 'product_tweet_stat',
    timestamps: false,
    sequelize
  }
);

module.exports = ProductTweetStat;
