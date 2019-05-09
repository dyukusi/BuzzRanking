const appRoot = require('app-root-path');
const con = require(appRoot + '/my_libs/db.js');
const Q = require('q');
const _ = require('underscore');
const ModelBase = require(appRoot + '/models/base');
const TABLE_NAME = 'daily_book_ranking';

module.exports = class DailyBookRanking extends ModelBase {
  constructor(date, product_id, tweet_count, user_count, is_invalid) {
    super();
    this.date = date;
    this.product_id = product_id;
    this.tweet_count = tweet_count;
    this.user_count = user_count;
    this.is_invalid = is_invalid;
  }

  getTweetCount() {
    return this.tweet_count;
  }

  getUserCount() {
    return this.user_count;
  }

  getProductId() {
    return this.product_id;
  }

  getIsInvalid() {
    return this.is_invalid;
  }

  getRank() {
    return this.rank;
  }

  setRank(rank) {
    this.rank = rank;
  }

  // ------------------- static functions -------------------
  static getTableName() {
    return TABLE_NAME;
  }

  static selectByDate(date, options) {
    var d = Q.defer();
    var that = this;

    var sql = 'SELECT * FROM daily_book_ranking WHERE date = ?';

    if (options.ignoreInvalidRecords) {
      sql += ' AND is_invalid = 0';
    }

    con.query(sql,
      [date.toLocaleDateString()],
      function (e, rows, fields) {
        if (e) {
          d.reject(e);
          con.rollback(function () {
            throw e;
          });
        }

        var models = _.map(rows, function (row) {
          return that.rowToModel(row);
        });

        d.resolve(models);
      }
    );

    return d.promise;
  }

  static insertRankingResult(insertObjects) {
    var d = Q.defer();

    con.beginTransaction(function (e) {
      if (e) {
        throw e;
      }

      con.query(
        'REPLACE daily_book_ranking (date, product_id, tweet_count, user_count, is_invalid) VALUES ?',
        [
          _.map(insertObjects, function (item) {
            return [
              item.date,
              item.product_id,
              item.tweet_count,
              item.user_count,
              item.is_invalid,
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

  static rowToModel(row) {
    return new DailyBookRanking(
      row['date'],
      row['product_id'],
      row['tweet_count'],
      row['user_count'],
      row['is_invalid'],
    );
  }
};


