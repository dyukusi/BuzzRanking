const appRoot = require('app-root-path');
const con = require(appRoot + '/my_libs/db.js');
const Q = require('q');
const _ = require('underscore');

module.exports = class RakutenBookModel {
  constructor(id, isbn_code, title, title_kana, sub_title, sub_title_kana, series, series_kana, contents, author, author_kana, publisher, size, caption, item_url, affiliate_item_url, image_url_base, chirayomi_url, price, review_count, review_rate_average, genre_id, sale_date_str, sale_date, created_at) {
    this.id = id;
    this.isbn_code = isbn_code;
    this.title = title;
    this.title_kana = title_kana;
    this.sub_title = sub_title;
    this.sub_title_kana = sub_title_kana;
    this.series = series;
    this.series_kana = series_kana;
    this.contents = contents;
    this.author = author;
    this.author_kana = author_kana;
    this.publisher = publisher;
    this.size = size;
    this.caption = caption;
    this.item_url = item_url;
    this.affiliate_item_url = affiliate_item_url;
    this.image_url_base = image_url_base;
    this.chirayomi_url = chirayomi_url;
    this.price = price;
    this.review_count = review_count;
    this.review_rate_average = review_rate_average;
    this.genre_id = genre_id;
    this.sale_date_str = sale_date_str;
    this.sale_date = sale_date;
    this.created_at = created_at;
  }

  getTitle() {
    return this.title;
  }

  getId() {
    return this.id;
  }

  getImageURLBase() {
    return this.image_url_base;
  }

  getPrice() {
    return this.price;
  }

  getAffiliateURL() {
    return this.affiliate_item_url;
  }

  getSaleDateStr() {
    return this.sale_date_str;
  }

  getISBNCode() {
    return this.isbn_code;
  }

  // ------------------- static functions -------------------
  static getProductType() {
    return 1;
  }

  static selectByIds(ids) {
    var d = Q.defer();
    var that = this;

    con.query('SELECT * FROM rakuten_book_product WHERE id IN (?)',
      [ids],
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

    con.beginTransaction(function (e) {
      if (e) {
        throw e;
      }

      con.query(
        'REPLACE rakuten_book_product (isbn_code, title, title_kana, sub_title, sub_title_kana, series, series_kana, contents, author, author_kana, publisher, size, caption, item_url, affiliate_item_url, image_url_base, chirayomi_url, price, review_count, review_rate_average, genre_id, sale_date_str, sale_date) VALUES ?',
        [
          _.map(insertObjects, function (item) {
            return [
              item.isbn_code,
              item.title,
              item.title_kana,
              item.sub_title,
              item.sub_title_kana,
              item.series,
              item.series_kana,
              item.contents,
              item.author,
              item.author_kana,
              item.publisher,
              item.size,
              item.caption,
              item.item_url,
              item.affiliate_item_url,
              item.image_url_base,
              item.chirayomi_url,
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

  static selectNewProductsByGenreId(genreId) {
    var d = Q.defer();
    var that = this;

    var currentDate = new Date();
    var from = new Date(currentDate.setDate(currentDate.getDate() - 7)).toLocaleString().replace(/\//g, '-');
    var to = new Date(currentDate.setDate(currentDate.getDate() + 7)).toLocaleString().replace(/\//g, '-');;

    con.query(
      'SELECT * FROM rakuten_book_product WHERE sale_date > ? && sale_date < ? && sale_date != \'9999-12-31\' && genre_id LIKE ?',
      [from, to, '%' + genreId + '%'],
      function (err, rows, fields) {
        var models = [];
        _.each(rows, function(row) {
          models.push(that.rowToModel(row));
        });
        d.resolve(models);
      }
    );

    return d.promise;
  }

  static selectAllNewProducts() {
    var d = Q.defer();
    var that = this;

    var from = new Date(new Date().setDate(new Date().getDate() - 7)).toLocaleString().replace(/\//g, '-');
    var to = new Date(new Date().setDate(new Date().getDate() + 7)).toLocaleString().replace(/\//g, '-');;

    console.log(from);
    console.log(to);

    con.query(
      'SELECT * FROM rakuten_book_product WHERE sale_date > ? && sale_date < ? && sale_date != \'9999-12-31\'',
      [from, to],
      function (err, rows, fields) {
        var models = [];
        _.each(rows, function(row) {
          models.push(that.rowToModel(row));
        });
        d.resolve(models);
      }
    );

    return d.promise;
  }

  static rowToModel(row) {
    return new RakutenBookModel(
      row['id'],
      row['isbn_code'],
      row['title'],
      row['title_kana'],
      row['sub_title'],
      row['sub_title_kana'],
      row['series'],
      row['series_kana'],
      row['contents'],
      row['author'],
      row['author_kana'],
      row['publisher'],
      row['size'],
      row['caption'],
      row['item_url'],
      row['affiliate_item_url'],
      row['image_url_base'],
      row['chirayomi_url'],
      row['price'],
      row['review_count'],
      row['review_rate_average'],
      row['genre_id'],
      row['sale_date_str'],
      row['sale_date'],
      row['created_at'],
    );
  }

};


