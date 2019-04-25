const appRoot = require('app-root-path');
const con = require(appRoot + '/my_libs/db.js');
const Q = require('q');
const _ = require('underscore');

module.exports = class DailyBookRanking {
  constructor(date, product_id, tweet_count, rank) {
    this.date = date;
    this.product_id = product_id;
    this.tweet_count = tweet_count;
    this.rank = rank;
  }

  getRank() {
    return this.rank;
  }

  getTweetCount() {
    return this.tweet_count;
  }

  getProductId() {
    return this.product_id;
  }

  // ------------------- static functions -------------------
  static selectByDate(date) {
    var d = Q.defer();
    var that = this;

    con.query('SELECT * FROM daily_book_ranking WHERE date = ?',
      [date.toLocaleDateString()],
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

  static insertRankingResult(insertObjects) {
    var d = Q.defer();

    con.beginTransaction(function (e) {
      if (e) {
        throw e;
      }

      con.query(
        'REPLACE daily_book_ranking (date, product_id, tweet_count, rank) VALUES ?',
        [
          _.map(insertObjects, function (item) {
            return [
              item.date,
              item.product_id,
              item.tweet_count,
              item.rank,
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


  static createDailyBookRanking(date) {
    var d = Q.defer();
    var that = this;

    con.beginTransaction(function (e) {
      if (e) {
        throw e;
      }

      // range is from 1week ago
      var tempDate = new Date(date);
      var oneWeekAgo = new Date(tempDate.setDate(tempDate.getDate() - 7));

      con.query('SELECT product_id, count(*) AS tweet_count FROM tweet WHERE ? < tweeted_at GROUP BY product_id ORDER BY tweet_count DESC',
        [oneWeekAgo.toLocaleDateString()],
        function (e, rows, fields) {
          if (e) {
            d.reject(e);
            con.rollback(function () {
              throw e;
            });
          }

          var rank = 1;
          var idx = 1;
          var previousTweetCount = null;
          var dateStr = date.toLocaleDateString();
          var insertObjects = _.map(rows, function (row) {
            var productId = row['product_id'];
            var tweetCount = Number(row['tweet_count']);

            if (previousTweetCount != tweetCount) {
              rank = idx;
            }

            previousTweetCount = tweetCount;
            idx++;

            return {
              date: dateStr,
              product_id: productId,
              tweet_count: tweetCount,
              rank: rank,
            };
          });

          that.insertRankingResult(insertObjects)
            .then(function () {
              con.commit(function (e) {
                if (e) {
                  d.reject();
                  con.rollback(function () {
                    throw e;
                  });
                }

                d.resolve();
              });
            })
            .fail(function (e) {
              d.reject(e);
              con.rollback(function () {
                throw e;
              });
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
      row['rank'],
    );
  }
};


