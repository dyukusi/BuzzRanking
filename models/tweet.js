const appRoot = require('app-root-path');
const con = require(appRoot + '/my_libs/db.js');
const Q = require('q');
const _ = require('underscore');
const ModelBase = require(appRoot + '/models/base');
const TABLE_NAME = 'tweet';
const Util = require(appRoot + '/my_libs/util.js');

module.exports = class Tweet extends ModelBase {
  constructor(tweet_id, retweet_target_id, product_type, product_id, source, user_id, name, screen_name, followers_count, follow_count, tweet_count, favourite_count, text, tweeted_at, created_at) {
    super();
    this.tweet_id = tweet_id;
    this.retweet_target_id = retweet_target_id;
    this.product_type = product_type;
    this.product_id = product_id;
    this.source = source;
    this.user_id = user_id;
    this.name = name;
    this.screen_name = screen_name;
    this.followers_count = followers_count;
    this.follow_count = follow_count;
    this.tweet_count = tweet_count;
    this.favourite_count = favourite_count;
    this.text = text;
    this.tweeted_at = tweeted_at;
    this.created_at = created_at;
  }

  getTweetId() {
    return this.tweet_id;
  }

  getRetweetTargetId() {
    return this.retweet_target_id;
  }

  getName() {
    return this.name;
  }

  getScreenName() {
    return this.screen_name;
  }

  getProductId() {
    return this.product_id;
  }

  getFavouriteCount() {
    return this.favourite_count;
  }

  getText() {
    return this.text;
  }

  static rowToModel(row) {
    return new Tweet(
      row['tweet_id'],
      row['retweet_target_id'],
      row['product_type'],
      row['product_id'],
      row['source'],
      row['user_id'],
      row['name'],
      row['screen_name'],
      row['followers_count'],
      row['follow_count'],
      row['tweet_count'],
      row['favourite_count'],
      row['text'],
      row['tweeted_at'],
      row['created_at'],
    );
  }

  static selectByProductTypeIdAndProductIds(productTypeId, productIds, options) {
    var d = Q.defer();
    var that = this;
    var placeHolderParams = [productTypeId, productIds];
    var sql = 'SELECT * FROM tweet WHERE product_type = ? AND product_id IN (?)';

    if (options.excludeRetweet) {
      sql += ' AND retweet_target_id IS NULL';
    }

    if (options.since) {
      sql += ' AND ? <= tweeted_at';
      placeHolderParams.push(Util.convertDateObjectIntoMySqlDateObjectReadableString(options.since));
    }

    if (options.until) {
      sql += ' AND tweeted_at <= ?';
      placeHolderParams.push(Util.convertDateObjectIntoMySqlDateObjectReadableString(options.until));
    }

    con.query(sql, placeHolderParams,
      function (e, rows, fields) {
        if (e) {
          d.reject(e);
          return con.rollback(function () {
            throw e;
          });
        }

        var models = _.map(rows, function(row) {
          return that.rowToModel(row);
        });

        d.resolve(models);
      }
    );

    return d.promise;
  }

  static selectByProductTypeId(productTypeId, options) {
    var d = Q.defer();
    var that = this;

    var placeHolderParams = [productTypeId];
    var sql = 'SELECT * FROM tweet WHERE product_type = ?';

    if (options.excludeRetweet) {
      sql += ' AND retweet_target_id IS NULL';
    }

    if (options.since) {
      sql += ' AND ? <= tweeted_at';
      placeHolderParams.push(Util.convertDateObjectIntoMySqlDateObjectReadableString(options.since));
    }

    if (options.until) {
      sql += ' AND tweeted_at <= ?';
      placeHolderParams.push(Util.convertDateObjectIntoMySqlDateObjectReadableString(options.until));
    }

    con.query(sql, placeHolderParams,
      function (e, rows, fields) {
        if (e) {
          d.reject(e);
          con.rollback(function () {
            throw e;
          });
        }

        var models = _.map(rows, function(row) {
          return that.rowToModel(row);
        });

        d.resolve(models);
      }
    );

    return d.promise;
  }

  static insert(insertObjects) {
    var d = Q.defer();

    if (_.isEmpty(insertObjects)) {
      d.resolve();
      return d.promise;
    }

    con.beginTransaction(function (e) {
      if (e) {
        throw e;
      }

      con.query(
        'REPLACE tweet (tweet_id, retweet_target_id, product_type, product_id, source, user_id, name, screen_name, followers_count, follow_count, tweet_count, favourite_count, text, tweeted_at) VALUES ?',
        [
          _.map(insertObjects, function (item) {
            return [
              item.tweet_id,
              item.retweet_target_id,
              item.product_type,
              item.product_id,
              item.source,
              item.user_id,
              item.name,
              item.screen_name,
              item.followers_count,
              item.follow_count,
              item.tweet_count,
              item.favourite_count,
              item.text,
              item.tweeted_at,
            ]
          })
        ],
        function (e, results, fields) {
          if (e) {
            d.reject(e);
            con.rollback(function () {
              throw e;
            });
          }

          con.commit(function (e) {
            if (e) {
              d.reject();
              con.rollback(function () {
                throw e;
              });
            }

            d.resolve();
          });
        }
      );

    });

    return d.promise;
  }

};


