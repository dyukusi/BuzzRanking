const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Util = require(appRoot + '/my_libs/util.js');

class TwitterAlternativeSearchWord extends Sequelize.Model {
  // ------------------- Instance Methods -------------------

  // ------------------- Class Methods -------------------
}

TwitterAlternativeSearchWord.init({
    productId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'product_id',
    },
    searchWord: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'search_word'
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      field: 'created_at'
    }
  }, {
    freezeTableName: true,
    underscored: true,
    modelName: 'twitter_alternative_search_word',
    timestamps: false,
    sequelize
  }
);

// NOTE: Sequelize considers 'id' as primary key in default if no primary key set but we dont need in this case
TwitterAlternativeSearchWord.removeAttribute('id');

module.exports = TwitterAlternativeSearchWord;
