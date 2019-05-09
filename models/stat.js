const appRoot = require('app-root-path');
const con = require(appRoot + '/my_libs/db.js');
const Q = require('q');
const ModelBase = require(appRoot + '/models/base');
const __ = require('underscore');

const TABLE_NAME = 'stat';

module.exports = class Stat extends ModelBase {
  constructor(id, product_type_id, ranking_date, stat_since, stat_until) {
    super();
    this.id = id;
    this.product_type_id = product_type_id;
    this.ranking_date = ranking_date;
    this.stat_since = stat_since;
    this.stat_until = stat_until;
  }

  getId() {
    return this.id;
  }

  getProductTypeId() {
    return this.product_type_id;
  }

  getRankingDate() {
    return this.ranking_date;
  }

  getStatSince() {
    return new Date(this.stat_since);
  }

  getStatUntil() {
    return new Date(this.stat_until);
  }

  // ------------------- static functions -------------------
  static getTableName() {
    return TABLE_NAME;
  }

  static rowToModel(row) {
    return new Stat(
      row['id'],
      row['product_type_id'],
      row['ranking_date'],
      row['stat_since'],
      row['stat_until'],
    );
  }

  static selectByProductTypeIdAndDate(productTypeId, date, options) {
    var d = Q.defer();
    var that = this;

    var sql = 'SELECT * FROM stat WHERE product_type_id = ? AND ranking_date = ?';

    con.query(sql,
      [
        productTypeId,
        date.toLocaleDateString(),
      ],
      function (e, rows, fields) {
        if (e) {
          d.reject(e);
          con.rollback(function () {
            throw e;
          });
        }

        d.resolve(that.rowToModel(rows[0]));
      }
    );

    return d.promise;
  }

  static createRankingData(targetProductTypeId, rankingDate, since, until, insertObjectForRankingData) {
    var d = Q.defer();

    con.beginTransaction(function (e) {
      if (e) {
        throw e;
      }

      con.query(
        'INSERT INTO stat (product_type_id, ranking_date, stat_since, stat_until) VALUES (?)',
        [[
          targetProductTypeId,
          rankingDate.toLocaleDateString(),
          since.toLocaleDateString(),
          until.toLocaleDateString(),
        ]],
        function (e, results, fields) {
          if (e) {
            console.log(e);
            d.reject(e);
            return con.rollback(function () {
              throw e;
            });
          }

          var rankingId = results.insertId;

          con.query(
            'REPLACE stat_data (stat_id, product_id, tweet_count, user_count, is_invalid) VALUES ?',
            [
              __.map(insertObjectForRankingData, function (item) {
                return [
                  rankingId,
                  item.product_id,
                  item.tweet_count,
                  item.user_count,
                  item.is_invalid,
                ]
              })
            ],
            function (e, results, fields) {
              if (e) {
                console.log(e);
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
                d.resolve(rankingId);
              });
            });

        }
      );

    });

    return d.promise;
  }
};
