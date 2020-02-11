const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');

class Seq extends Sequelize.Model {
  // ------------------- Instance Methods -------------------

  // ------------------- Class Methods -------------------
  static async getNewProductId(transaction) {
    if (__.isEmpty(transaction)) {
      throw new Error('transaction object is required to get new id');
    }

    var seqModel = await this.findOne({
      transaction: transaction,
    });

    var newId = seqModel.id;

    var row = await sequelize.query(
      "UPDATE seq SET id = id + 1;", {
        transaction: transaction,
      }
    );

    // NOTE: below method doesn't work. idk why :(
    // await seqModel.update({
    //   id: newId + 1,
    // }, {
    //   transaction: transaction,
    // });

    return newId;
  }
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
