const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');

class Ranking extends Sequelize.Model {
  // ------------------- Instance Methods -------------------
  // ------------------- Class Methods -------------------
}

Ranking.init({
    date: {
      type: Sequelize.DATE,
      primaryKey: true,
      allowNull: false,
      field: 'date'
    },
    type: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      primaryKey: true,
      allowNull: false,
      field: 'type'
    },
    productTypeBundleId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      primaryKey: true,
      allowNull: false,
      field: 'product_type_bundle_id'
    },
    productTypeId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      primaryKey: true,
      allowNull: false,
      field: 'product_type_id'
    },
    productBundleId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      primaryKey: true,
      allowNull: false,
      field: 'product_bundle_id'
    },
    rank: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'rank'
    }
  }, {
    freezeTableName: true,
    underscored: true,
    modelName: 'ranking',
    timestamps: false,
    sequelize
  }
);

module.exports = Ranking;
