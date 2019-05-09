const appRoot = require('app-root-path');
const con = require(appRoot + '/my_libs/db.js');
const Q = require('q');
const _ = require('underscore');
const memoryCache = require('memory-cache');

module.exports = class Base {
  constructor() {}

  static getTableName() {
    throw new Error('Not implemented');
  }

  static rowToModel() {
    throw new Error('Not implemented');
  }

  static getLastUpdatedDateObject() {
    var d = Q.defer();

    con.query('SELECT update_time FROM information_schema.tables WHERE table_name = ?',
      [this.getTableName()],
      function (e, rows, fields) {
        if (e) {
          d.reject(e);
          con.rollback(function () {
            throw e;
          });
        }

        d.resolve(new Date(rows[0].update_time));
      }
    );

    return d.promise;
  }

  static selectAll() {
    var d = Q.defer();
    var that = this;

    con.query('SELECT * FROM ' + this.getTableName(),
      [],
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
}
