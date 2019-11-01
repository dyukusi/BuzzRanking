const appRoot = require('app-root-path');
const Q = require('q');
const __ = require('underscore');
const DBUtil = require(appRoot + '/my_libs/db_util.js');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Op = Sequelize.Op;
const Moment = require('moment');
const sprintf = require('sprintf-js').sprintf;

class NewTweet extends Sequelize.Model {
  // ------------------- Instance Methods -------------------

  // ------------------- Class Methods -------------------
  static selectByProductIds(productIds, options) {
    options = options || {};

    var where = {
      productId: productIds,
    };

    // if (options.excludeRetweet) {
    //   where.retweetTargetId = null;
    // }

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

  // NOTE: you must update query when the new_tweet table definition is changed
  static async selectLatestTweetsOfEachProductId(productIds, countPerGroup) {
    var query = sprintf(
      "SELECT id, quote_tweet_id, product_id, user_id, name, screen_name, favourite_count, retweet_count, source_id, text, is_invalid, tweeted_at, created_at FROM ( SELECT  @prev := '', @n := 0 ) init JOIN ( SELECT  @n := if(product_id != @prev, 1, @n + 1) AS n, @prev := product_id, id, quote_tweet_id, product_id, user_id, name, screen_name, favourite_count, retweet_count, source_id, text, is_invalid, tweeted_at, created_at FROM  new_tweet WHERE product_id IN (%s) ORDER BY product_id ASC, tweeted_at DESC) AS x WHERE  n <= %d ORDER BY  product_id, n;",
      productIds.join(','),
      countPerGroup,
    );

    let tweetModels = (await sequelize.query(query, {
      mapToModel: true,
      model: NewTweet,
    }));

    return tweetModels;
  }

  static updateIsInvalid(tweetId, isInvalid) {
    return this.update({
      isInvalid: isInvalid,
    }, {
      where: {
        id: tweetId
      }
    });
  }
}

NewTweet.init({
    id: {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: '',
      primaryKey: true,
      field: 'id'
    },
    quote_tweet_id: {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: '',
      field: 'quote_tweet_id'
    },
    productId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      primaryKey: true,
      field: 'product_id'
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
    favouriteCount: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'favourite_count'
    },
    retweetCount: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'retweet_count'
    },
    sourceId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'source_id'
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
    modelName: 'new_tweet',
    timestamps: false,
    sequelize
  }
);

module.exports = NewTweet;
