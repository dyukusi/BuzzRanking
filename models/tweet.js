const appRoot = require('app-root-path');
const Q = require('q');
const __ = require('underscore');
const DBUtil = require(appRoot + '/my_libs/db_util.js');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Op = Sequelize.Op;
const Moment = require('moment');

class Tweet extends Sequelize.Model {
  // ------------------- Instance Methods -------------------

  // ------------------- Class Methods -------------------
    static selectByProductIds(productIds, options) {
    options = options || {};

    var where = {
      productId: productIds,
    };

    if (options.excludeRetweet) {
      where.retweetTargetId = null;
    }

    if (options.excludeInvalidTweets) {
      where.isInvalid = 0;
    }

    if (options.since) {
      where.tweetedAt = where.tweetedAt || {};

      var sinceMoment = new Moment(options.since);
      where.tweetedAt[Op.gte] = sinceMoment.format();
    }

    if (options.until) {
      where.tweetedAt = where.tweetedAt || {};

      var untilMoment = new Moment(options.until);
      where.tweetedAt[Op.lte] = untilMoment.format();
    }

    return this.findAll({
      where: where,
    });
  }

  static updateIsInvalid(tweetId, isInvalid) {
    return this.update({
      isInvalid: isInvalid,
    }, {
      where: {
        tweetId: tweetId
      }
    });
  }
}

Tweet.init({
    tweetId: {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: '',
      primaryKey: true,
      field: 'tweet_id'
    },
    retweetTargetId: {
      type: Sequelize.STRING(20),
      allowNull: true,
      field: 'retweet_target_id'
    },
    productId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      primaryKey: true,
      field: 'product_id'
    },
    source: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'source'
    },
    userId: {
      type: Sequelize.BIGINT,
      allowNull: false,
      field: 'user_id'
    },
    name: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'name'
    },
    screenName: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'screen_name'
    },
    followersCount: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'followers_count'
    },
    followCount: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'follow_count'
    },
    tweetCount: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'tweet_count'
    },
    favouriteCount: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'favourite_count'
    },
    text: {
      type: Sequelize.TEXT,
      allowNull: false,
      field: 'text'
    },
    isInvalid: {
      type: Sequelize.INTEGER(1),
      allowNull: false,
      defaultValue: '0',
      field: 'is_invalid'
    },
    tweetedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      field: 'tweeted_at'
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
    modelName: 'tweet',
    timestamps: false,
    sequelize
  }
);

module.exports = Tweet;
