const appRoot = require('app-root-path');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Op = Sequelize.Op;
const Moment = require('moment');
const sprintf = require('sprintf-js').sprintf;
const ProductBundle = require(appRoot + '/models/product_bundle');

class Tweet extends Sequelize.Model {
  // ------------------- Instance Methods -------------------

  // ------------------- Class Methods -------------------
  static countUserNumPerDay(productBundleId, sinceStr) {
    sinceStr = sinceStr || '0000-00-00';

    return sequelize.query(
      "SELECT DATE(t1.tweeted_at) AS date, COUNT(*) AS count FROM (SELECT screen_name, MAX(tweeted_at) AS tweeted_at FROM tweet WHERE product_bundle_id = :productBundleId AND DATE(tweeted_at) > :sinceStr GROUP BY screen_name) AS t1 GROUP BY DATE(tweeted_at) ORDER BY date ASC;",
      {
        replacements: {
          productBundleId: productBundleId,
          sinceStr: sinceStr,
        },
        type: Sequelize.QueryTypes.SELECT,
      }
    );
  }

  static countTweetNumPerDay(productBundleId, sinceStr) {
    sinceStr = sinceStr || '0000-00-00';

    return sequelize.query(
      "SELECT DATE(tweeted_at) AS date, COUNT(*) AS count FROM tweet WHERE product_bundle_id = :productBundleId AND DATE(tweeted_at) > :sinceStr GROUP BY DATE(tweeted_at) ORDER BY date ASC",
      {
        replacements: {
          productBundleId: productBundleId,
          sinceStr: sinceStr,
        },
        type: Sequelize.QueryTypes.SELECT,
      }
    );
  }

  static selectByDateRange(since, until) {
    var sinceMoment = new Moment(since);
    var untilMoment = new Moment(until);

    return this.findAll({
      where: {
        tweetedAt: {
          [Op.gte]: sinceMoment.format(),
          [Op.lte]: untilMoment.format(),
        },
      },
    });
  }

  static selectByProductBundleIds(productBundleIds, options) {
    options = options || {};

    var where = {
      productBundleId: productBundleIds,
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
  static async selectLatestTweetsOfEachProductBundleId(productBundleIds, countPerGroup) {
    var query = sprintf(
      "SELECT id, quote_tweet_id, product_bundle_id, user_id, name, screen_name, favourite_count, retweet_count, source_id, text, is_invalid, tweeted_at, created_at FROM ( SELECT  @prev := '', @n := 0 ) init JOIN ( SELECT  @n := if(product_bundle_id != @prev, 1, @n + 1) AS n, @prev := product_bundle_id, id, quote_tweet_id, product_bundle_id, user_id, name, screen_name, favourite_count, retweet_count, source_id, text, is_invalid, tweeted_at, created_at FROM tweet WHERE product_bundle_id IN (%s) ORDER BY product_bundle_id ASC, tweeted_at DESC) AS x WHERE  n <= %d ORDER BY  product_bundle_id, n;",
      productBundleIds.join(','),
      countPerGroup,
    );

    let tweetModels = (await sequelize.query(query, {
      mapToModel: true,
      model: Tweet,
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

Tweet.init({
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
    productBundleId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      primaryKey: true,
      field: 'product_bundle_id'
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
    modelName: 'tweet',
    timestamps: false,
    sequelize
  }
);

Tweet.belongsTo(ProductBundle,{
  foreignKey: "productBundleId",
  targetKey: "id",
});

module.exports = Tweet;

// 2020-01-11	1124
// 2020-01-12	1062
// 2020-01-13	1164
// 2020-01-14	839
// 2020-01-15	783
// 2020-01-16	146
//
// 2020-01-11	905
// 2020-01-12	860
// 2020-01-13	949
// 2020-01-14	711
// 2020-01-15	703
// 2020-01-16	136
