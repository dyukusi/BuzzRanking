const appRoot = require('app-root-path');
const con = require(appRoot + '/my_libs/db.js');
const Q = require('q');
const _ = require('underscore');

const TABLE_NAME = 'a8_program';

module.exports = class A8Program {
  constructor(product_id, product_type_id, display_name, a8_program_id, program_name, ad_target_url, ad_html, parent_a8_program_local_id) {
    this.product_id = product_id;
    this.product_type_id = product_type_id;
    this.a8_program_id = a8_program_id;
    this.display_name = display_name;
    this.program_name = program_name;
    this.ad_target_url = ad_target_url;
    this.ad_html = ad_html;
    this.parent_a8_program_local_id = parent_a8_program_local_id;
  }

  getProductId() {
    return this.product_id;
  }

  getProductTypeId() {
    return this.product_type_id;
  }

  getProgramName() {
    return this.program_name;
  }

  getDisplayName() {
    return this.display_name;
  }

  getAdTargetURL() {
    return this.ad_target_url;
  }

  getAdHTML() {
    return this.ad_html;
  }

  getA8ProgramId() {
    return this.a8_program_id;
  }

  // ------------------- static functions -------------------
  static getTableName() {
    return TABLE_NAME;
  }

  static rowToModel(row) {
    return new A8Program(
      row['product_id'],
      row['product_type_id'],
      row['display_name'],
      row['a8_program_id'],
      row['program_name'],
      row['ad_target_url'],
      row['ad_html'],
      row['parent_a8_program_local_id'],
    );
  }

  static selectByProductTypeIds(productTypeIds, options) {
    var d = Q.defer();
    var that = this;

    var sql = 'SELECT * FROM a8_program WHERE product_type_id IN (?)';

    if (options.ignoreChildProgram) {
      sql += ' AND parent_a8_program_local_id IS NULL';
    }

    con.query(sql,
      [productTypeIds],
      function (e, rows, fields) {
        if (e) {
          d.reject(e);
          con.rollback(function () {
            throw e;
          });
        }

        d.resolve(
          _.map(rows, row => {
            return that.rowToModel(row);
          })
        );
      }
    );

    return d.promise;
  }

  static selectByProductIds(productIds) {
    var d = Q.defer();
    var that = this;

    con.query('SELECT * FROM a8_program WHERE product_id IN (?)',
      [
        productIds
      ],
      function (e, rows, fields) {
        if (e) {
          d.reject(e);
          con.rollback(function () {
            throw e;
          });
        }

        d.resolve(
          _.map(rows, row => {
            return that.rowToModel(row);
          })
        );
      }
    );

    return d.promise;
  }
};


