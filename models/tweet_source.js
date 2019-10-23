const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');

class TweetSource extends Sequelize.Model {
  // ------------------- Instance Methods -------------------

  // ------------------- Class Methods -------------------
  static async getModelBySourceTextAndInsertIfNeed(sourceText) {
    var model = await this.findOne({
      where: {
        sourceText: sourceText,
      }
    });

    if (model) return model;

    var insertedModel = await this.create({
      sourceText: sourceText,
    });

    return insertedModel;
  }
}

TweetSource.init({
    id: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: 'id'
    },
    sourceText: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'source_text'
    }
  }, {
    freezeTableName: true,
    underscored: true,
    modelName: 'tweet_source',
    timestamps: false,
    sequelize
  }
);

module.exports = TweetSource;

