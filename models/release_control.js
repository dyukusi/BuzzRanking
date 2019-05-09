const appRoot = require('app-root-path');
const con = require(appRoot + '/my_libs/db.js');
const Q = require('q');
const _ = require('underscore');
const ModelBase = require(appRoot + '/models/base');
const TABLE_NAME = 'release_control';

module.exports = class ReleaseControl extends ModelBase {
  constructor(product_type_id, date) {
    super();
    this.product_type_id = product_type_id;
    this.date = date;
  }

  getProductId() {
    return this.product_type_id;
  }

  getDateObj() {
    return new Date(this.date);
  }

  // ------------------- static functions -------------------
  static getTableName() {
    return TABLE_NAME;
  }

  static selectByProductTypeId(productTypeId) {
    var d = Q.defer();
    var that = this;

    con.query('SELECT * FROM release_control WHERE product_type_id = ?',
      [productTypeId],
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

  static rowToModel(row) {
    return new ReleaseControl(
      row['id'],
      row['date'],
    );
  }
};


