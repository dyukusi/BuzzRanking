const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Moment = require('moment');
const Q = require('q');

class ReleaseControl extends Sequelize.Model {
  // ------------------- Instance Methods -------------------
  getMoment() {
    return new Moment(this.date);
  }

  // ------------------- Class Methods -------------------
  static selectLatest() {
    // var d = Q.defer();
    //
    // this.findAll({
    //   order: [
    //     ['date', 'DESC']
    //   ],
    //   limit: 1,
    // }).then(models => {
    //   return d.resolve(models[0]);
    // });
    //
    // return d.promise;

    return this.findOne({
      order: [
        ['date', 'DESC']
      ],
    });
  }

  static async selectLastReleaseDate() {
    var releaseControlModels = await this.findAll({
      order: [
        ['date', 'DESC']
      ],
      limit: 2,
    });

    return releaseControlModels[1];
  }

  static insert(date) {
    return this.create({
      date: Util.convertDateObjectIntoMySqlReadableString(date),
    });
  }
}

ReleaseControl.init({
    date: {
      type: Sequelize.DATEONLY,
      allowNull: false,
      field: 'date',
      primaryKey: true,
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      field: 'created_at'
    },
  }, {
    freezeTableName: true,
    underscored: true,
    modelName: 'release_control',
    timestamps: false,
    sequelize
  }
);

module.exports = ReleaseControl;
