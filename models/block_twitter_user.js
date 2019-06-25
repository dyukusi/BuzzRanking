const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');

class BlockTwitterUser extends Sequelize.Model {
  // ------------------- Instance Methods -------------------

  // ------------------- Class Methods -------------------
}

BlockTwitterUser.init({
    screenName: {
      type: Sequelize.STRING(255),
      allowNull: false,
      primaryKey: true,
      field: 'screen_name'
    }
  }, {
    freezeTableName: true,
    underscored: true,
    modelName: 'block_twitter_user',
    timestamps: false,
    sequelize
  }
);

module.exports = BlockTwitterUser;
