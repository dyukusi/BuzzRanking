const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');

// NOTE: this method only works with BeforeInsert trigger for sequence productId
exports.productBulkInsertUpdateOnDuplicate = function (ModelClass, rawInsertObjects) {
  if (__.some(rawInsertObjects, obj => { return obj.productId; })) {
    throw new Error('product id should not be set by manually! see BeforeInsert trigger');
  }

  return sequelize.transaction(async function (tx) {
    var uniqueKeyColumnName = __.map(__.values(ModelClass.uniqueKeys), obj => {
      return obj.column;
    })[0];

    if (!uniqueKeyColumnName) {
      throw new Error('ERROR: product table must have at least one unique key column');
    }

    var where = {};
    where[uniqueKeyColumnName] = __.map(rawInsertObjects, obj => {
      return obj[uniqueKeyColumnName];
    });

    var alreadyExistModelHash = {};
    await ModelClass.findAll({
      where: where,
    })
      .then(models => {
        alreadyExistModelHash = __.indexBy(models, m => {
          return m[uniqueKeyColumnName];
        });
      });

    var insertObjects = [];
    var updateObjects = [];
    __.each(rawInsertObjects, obj => {
      var alreadyExistModel = alreadyExistModelHash[obj[uniqueKeyColumnName]];
      if (alreadyExistModel) {
        obj.productId = alreadyExistModel.productId;
        updateObjects.push(obj);
      } else {
        insertObjects.push(obj);
      }
    });
    var updateObjectHash = __.indexBy(updateObjects, obj => {
      return obj[uniqueKeyColumnName];
    });

    // insert
    var insertPromise = ModelClass.bulkCreate(insertObjects, {
      transaction: tx,
    });

    // update
    var updatePromises = [];
    __.each(alreadyExistModelHash, m => {
      var updateObject = updateObjectHash[m[uniqueKeyColumnName]];
      var targetColumns = __.filter(__.keys(updateObject), column => {
        return column != 'productId' && column != 'createdAt' && column != 'updatedAt';
      });

      __.each(targetColumns, column => {
        m.set(column, updateObject[column]);
      });

      updatePromises.push(
        m.save({
          transaction: tx,
        })
      );
    });

    return await Promise.all(__.flatten([insertPromise, updatePromises])).then(results => {
      console.log('inserted records: ' + insertObjects.length + '  updated records: ' + updateObjects.length);
      return __.flatten(results);
    });
  });
};
