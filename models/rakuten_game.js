const appRoot = require('app-root-path');
const con = require(appRoot + '/my_libs/db.js');
const Q = require('q');
const _ = require('underscore');

module.exports = class RakutenGameModel {
  static insert(insertObjects) {
    var d = Q.defer();

    con.beginTransaction(function (e) {
      if (e) {
        throw e;
      }

      con.query(
        'REPLACE rakuten_game_product (id, jan_code, title, title_kana, made_by, maker_code, caption, item_url, affiliate_item_url, image_url_base, price, review_count, review_rate_average, genre_id, sale_date_str, sale_date) VALUES ?',
        [_.map(insertObjects, function (item) {
          return [
            item.id,
            item.jan_code,
            item.title,
            item.title_kana,
            item.made_by,
            item.maker_code,
            item.caption,
            item.item_url,
            item.affiliate_item_url,
            item.image_url_base,
            item.price,
            item.review_count,
            item.review_rate_average,
            item.genre_id,
            item.sale_date_str,
            item.sale_date,
          ]
        })],
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
