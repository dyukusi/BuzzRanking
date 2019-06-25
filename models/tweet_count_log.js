const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Util = require(appRoot + '/my_libs/util.js');

class TweetCountLog extends Sequelize.Model {
  // ------------------- Instance Methods -------------------
  static selectByProductId(productId) {
    return this.findAll({
      where: {
        productId: productId,
      }
    });
  }
  // ------------------- Class Methods -------------------
}

TweetCountLog.init({
    productId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'product_id'
    },
    tweetCount: {
      type: Sequelize.INTEGER(11),
      allowNull: false,
      field: 'tweet_count'
    },
    userCount: {
      type: Sequelize.INTEGER(11),
      allowNull: false,
      field: 'user_count'
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
    modelName: 'tweet_count_log',
    timestamps: false,
    sequelize
  }
);

// NOTE: Sequelize considers 'id' as primary key in default if no primary key set but we dont need in this case
TweetCountLog.removeAttribute('id');

module.exports = TweetCountLog;
