const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Op = Sequelize.Op;
const Util = require(appRoot + '/lib/util.js');

class TwitterAlternativeSearchWord extends Sequelize.Model {
  // ------------------- Instance Methods -------------------
  isValid() {
    return Util.isValidByStatus(this.validityStatus);
  }

  // ------------------- Class Methods -------------------
  static selectByProductBundleIds(productBundleIds) {
    return this.findAll({
      where: {
        productBundleId: productBundleIds,
      }
    });
  }

  static selectAllValid() {
    return this.findAll({
      where: {
        validityStatus: {
          [Op.or]: Const.VALID_STATUS_IDS,
        },
      }
    });
  }

  static async insertIfValid(productBundleId, word) {
    var isSuspicious = await Util.isSuspiciousTitle(word);
    if (isSuspicious) return;

    return this.upsert({
      productBundleId: productBundleId,
      searchWord: word,
    });
  }
}

TwitterAlternativeSearchWord.init({
    productBundleId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'product_bundle_id',
    },
    searchWord: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'search_word'
    },
    validityStatus: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'validity_status'
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      field: 'updated_at'
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
