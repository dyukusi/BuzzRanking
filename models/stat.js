const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const StatData = require(appRoot + '/models/stat_data');
const Moment = require('moment');

class Stat extends Sequelize.Model {
  // ------------------- Instance Methods -------------------
  getRankingDateObj() {
    return new Date(this.rankingDate);
  }

  // ------------------- Class Methods -------------------
  static selectByRankingDate(dateMoment) {
    return this.findOne({
      where: {
        rankingDate: dateMoment.format(),
      },
    });
  }

  static async createRankingData(rankingMoment, sinceMoment, untilMoment, insertObjectForStatData) {
    var that = this;
    return sequelize.transaction(async function (tx) {
      var statModel = await that.create({
        rankingDate: rankingMoment.format(),
        statSince: sinceMoment.format(),
        statUntil: untilMoment.format(),
      });

      var statId = statModel.id;

      __.each(insertObjectForStatData, obj => {
        obj.statId = statId;
      });

      await StatData.bulkCreate(insertObjectForStatData)
        .then(insertedModels => {});
    });
  }
}

Stat.init({
    id: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: 'id'
    },
    rankingDate: {
      type: Sequelize.DATEONLY,
      allowNull: false,
      field: 'ranking_date'
    },
    statSince: {
      type: Sequelize.DATEONLY,
      allowNull: false,
      field: 'stat_since'
    },
    statUntil: {
      type: Sequelize.DATEONLY,
      allowNull: false,
      field: 'stat_until'
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
    modelName: 'stat',
    timestamps: false,
    sequelize
  }
);

module.exports = Stat;
