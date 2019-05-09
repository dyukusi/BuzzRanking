const appRoot = require('app-root-path');
const con = require(appRoot + '/my_libs/db.js');
const Q = require('q');
const _ = require('underscore');
const ModelBase = require(appRoot + '/models/base');
const TABLE_NAME = 'twitter_alternative_search_word';

module.exports = class TwitterAlternativeSearchWord extends ModelBase {
  constructor(product_type_id, product_id, search_word) {
    super();
    this.product_type_id = product_type_id;
    this.product_id = product_id;
    this.search_word = search_word;
  }

  getProductTypeId() {
    return this.product_type_id;
  }

  getProductId() {
    return this.product_id;
  }

  getSearchWord() {
    return this.search_word;
  }

  // ------------------- static functions -------------------
  static getTableName() {
    return TABLE_NAME;
  }
  
  static rowToModel(row) {
    return new TwitterAlternativeSearchWord(
      row['product_type_id'],
      row['product_id'],
      row['search_word'],
    );
  }
};


