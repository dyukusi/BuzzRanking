const appRoot = require('app-root-path');
const __ = require('underscore');
const DBUtil = require(appRoot + '/my_libs/db_util.js');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');

class Seq extends Sequelize.Model {
  // ------------------- Instance Methods -------------------

  // ------------------- Class Methods -------------------
}

Seq.init({
    id: {
      type: Sequelize.BIGINT,
      allowNull: false,
      defaultValue: '0',
      field: 'id',
      primaryKey: true,
    }
  }
  , {
    freezeTableName: true,
    underscored: true,
    modelName: 'seq',
    timestamps: false,
    sequelize
  }
);

module.exports = Seq;
