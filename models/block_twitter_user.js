const appRoot = require('app-root-path');
const con = require(appRoot + '/my_libs/db.js');
const Q = require('q');
const _ = require('underscore');

// example
// INSERT IGNORE INTO block_twitter_user (screen_name) (SELECT DISTINCT screen_name FROM tweet WHERE name LIKE '%アニメイト%');

module.exports = class BlockTwitterUser {
  constructor(screen_name) {
    this.screen_name = screen_name;
  }

  getScreenName() {
    return this.screen_name;
  }

  static rowToModel(row) {
    return new BlockTwitterUser(
      row['screen_name'],
    );
  }

  static selectAll() {
    var d = Q.defer();
    var that = this;

    con.query('SELECT * FROM block_twitter_user',
      [],
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

};


