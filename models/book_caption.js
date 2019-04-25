const appRoot = require('app-root-path');
const con = require(appRoot + '/my_libs/db.js');
const Q = require('q');
const _ = require('underscore');

module.exports = class BookCaption {
  constructor(isbn_code, caption) {
    this.isbn_code = isbn_code;
    this.caption = caption;
  }

  getISBNCode() {
    return this.isbn_code;
  }

  getCaption() {
    return this.caption;
  }

  // ------------------- static functions -------------------
  static selectByISBNCodes(isbnCodes) {
    var d = Q.defer();
    var that = this;

    con.query('SELECT * FROM book_caption WHERE isbn_code IN (?)',
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

    con.beginTransaction(function (e) {
      if (e) {
        throw e;
      }

      con.query(
        'REPLACE book_caption (isbn_code, caption) VALUES ?',
        [
          _.map(insertObjects, function (item) {
            return [
              item.isbn_code,
              item.caption,
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
    return new BookCaption(
      row['isbn_code'],
      row['caption'],
    );
  }
};


