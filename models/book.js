const appRoot = require('app-root-path');
const con = require(appRoot + '/my_libs/db.js');
const Q = require('q');
const _ = require('underscore');
const ModelBase = require(appRoot + '/models/base');
const TABLE_NAME = 'book';

module.exports = class Book extends ModelBase {
  constructor(product_id, product_type_id, isbn_code, title, title_kana, sub_title, sub_title_kana, series, series_kana, contents, author, author_kana, publisher, size, caption, item_url, affiliate_item_url, image_url_base, chirayomi_url, price, review_count, review_rate_average, genre_id, sale_date_str, sale_date, created_at) {
    super();
    this.product_id = product_id;
    this.product_type_id = product_type_id;
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

  getProductId() {
    return this.product_id;
  }

  getProductTypeId() {
    return this.product_type_id;
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
  static getTableName() {
    return TABLE_NAME;
  }

  static getProductType() {
    return 1;
  }

  static selectByProductTypeIdAndProductIds(productTypeId, productIds) {
    var d = Q.defer();
    var that = this;

    con.query('SELECT * FROM book WHERE product_type_id = ? AND product_id IN (?)',
      [
        productTypeId,
        productIds
      ],
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

  static selectByISBNCodes(isbnCodes) {
    var d = Q.defer();
    var that = this;

    con.query('SELECT * FROM book WHERE isbn_code IN (?)',
      [isbnCodes],
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
      return d.resolve();
    }

    con.beginTransaction(function (e) {
      if (e) {
        throw e;
      }

      con.query(
        'INSERT INTO book (product_type_id, isbn_code, title, title_kana, sub_title, sub_title_kana, series, series_kana, contents, author, author_kana, publisher, size, caption, item_url, affiliate_item_url, image_url_base, chirayomi_url, price, review_count, review_rate_average, genre_id, sale_date_str, sale_date) VALUES ?',
        [
          _.map(insertObjects, function (item) {
            return [
              item.product_type_id,
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


  static replace(insertObjects) {
    var d = Q.defer();

    if (_.isEmpty(insertObjects)) {
      return d.resolve();
    }


    con.beginTransaction(function (e) {
      if (e) {
        throw e;
      }

      con.query(
        'REPLACE book (product_id, product_type_id, isbn_code, title, title_kana, sub_title, sub_title_kana, series, series_kana, contents, author, author_kana, publisher, size, caption, item_url, affiliate_item_url, image_url_base, chirayomi_url, price, review_count, review_rate_average, genre_id, sale_date_str, sale_date) VALUES ?',
        [
          _.map(insertObjects, function (item) {
            return [
              item.product_id,
              item.product_type_id,
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
      'SELECT * FROM book WHERE sale_date > ? && sale_date < ? && sale_date != \'9999-12-31\' && genre_id LIKE ?',
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

  static selectByProductTypeId(productTypeId, options) {
    var d = Q.defer();
    var that = this;

    var placeHolderParams = [productTypeId];
    var sql = 'SELECT * FROM book WHERE product_type_id = ?';
    //  sale_date > ? && sale_date < ?'

    if (options.excludeUndefinedReleaseDate) {
      sql += ' AND sale_date != \'9999-12-31\'';
    }

    if (options.since) {
      sql += ' AND ? <= sale_date';
      placeHolderParams.push(options.since.toLocaleString());
    }

    if (options.until) {
      sql += ' AND sale_date <= ?';
      placeHolderParams.push(options.until.toLocaleString());
    }

    con.query(sql,
      placeHolderParams,
      function (err, rows, fields) {
        if (err) {
          console.log(err);
          console.log(sql);
          console.log(placeHolderParams);
          throw new Error(err);
        }

        var models = [];
        _.each(rows, function(row) {
          models.push(that.rowToModel(row));
        });

        d.resolve(models);
      }
    );

    return d.promise;
  }

  static selectAllNewProducts(baseDate, rangeDays) {
    var d = Q.defer();
    var that = this;

    var tempDate = new Date(baseDate);
    var from = new Date(tempDate.setDate(tempDate.getDate() - rangeDays)).toLocaleString().replace(/\//g, '-');

    tempDate = new Date(baseDate);
    var to = new Date(tempDate.setDate(tempDate.getDate() + rangeDays)).toLocaleString().replace(/\//g, '-');;

    console.log("selecting target products... " + from + "  ~  " + to);

    con.query(
      'SELECT * FROM book WHERE sale_date > ? && sale_date < ? && sale_date != \'9999-12-31\'',
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
    return new Book(
      row['product_id'],
      row['product_type_id'],
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
