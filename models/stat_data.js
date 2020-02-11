const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Moment = require('moment');

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
}

StatData.init({
    statId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      primaryKey: true,
      field: 'stat_id'
    },
    productBundleId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      primaryKey: true,
      field: 'product_bundle_id'
    },
    tweetCount: {
      type: Sequelize.INTEGER(10).UNSIGNED,
      allowNull: false,
      field: 'tweet_count'
    },
    buzz: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'buzz'
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
    modelName: 'stat_data',
    timestamps: false,
    sequelize
  }
);

module.exports = StatData;
