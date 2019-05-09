const appRoot = require('app-root-path');
const con = require(appRoot + '/my_libs/db.js');
const Q = require('q');
const _ = require('underscore');
const ModelBase = require(appRoot + '/models/base');
const TABLE_NAME = 'block_twitter_user';

// example
// INSERT IGNORE INTO block_twitter_user (screen_name) (SELECT DISTINCT screen_name FROM tweet WHERE name LIKE '%アニメイト%');

module.exports = class BlockTwitterUser extends ModelBase {
  constructor(screen_name) {
    super();
    this.screen_name = screen_name;
  }

  getScreenName() {
    return this.screen_name;
  }

  static getTableName() {
    return TABLE_NAME;
  }

  static rowToModel(row) {
    return new BlockTwitterUser(
      row['screen_name'],
    );
  }
};


