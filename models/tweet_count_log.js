const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');

class TweetCountLog extends Sequelize.Model {
  // ------------------- Instance Methods -------------------

  // ------------------- Class Methods -------------------
  // static selectLatestPerDayByProductBundleId(productBundleId) {
  //   return sequelize.query(
  //     "SELECT TweetCountLogA.product_bundle_id, TweetCountLogA.tweet_count, TweetCountLogA.buzz, TweetCountLogA.created_at FROM tweet_count_log AS TweetCountLogA INNER JOIN (SELECT product_bundle_id, MAX(created_at) AS latest_date FROM tweet_count_log WHERE product_bundle_id = :productBundleId GROUP BY DATE(created_at)) AS TweetCountLogB ON TweetCountLogA.product_bundle_id = TweetCountLogB.product_bundle_id AND TweetCountLogA.created_at = TweetCountLogB.latest_date ORDER BY created_at ASC",
  //     {
  //       model: this,
  //       replacements: {
  //         productBundleId: productBundleId,
  //       },
  //       type: Sequelize.QueryTypes.SELECT,
  //     }
  //   );
  // }


}

TweetCountLog.init({
    productBundleId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'product_bundle_id'
    },
    tweetCount: {
      type: Sequelize.INTEGER(11),
      allowNull: false,
      field: 'tweet_count'
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
