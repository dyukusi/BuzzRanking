const appRoot = require('app-root-path');
const {JSDOM} = require('jsdom');
const $ = jQuery = require('jquery')(new JSDOM().window);
const CONST = require(appRoot + '/lib/const.js');
const _ = require('underscore');
const Util = require(appRoot + '/lib/util.js');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Moment = require('moment');
const ProductNum = require(appRoot + '/models/product_num');
const sprintf = require('sprintf-js').sprintf;
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
const ProductUtil = require(appRoot + '/lib/product_util.js');

var targetMoment = new Moment(process.argv[2]);
if (!process.argv[2] || !targetMoment.isValid()) {
  throw new Error('pls specify args. ex.. node update_product_num_table.js 2019-11-11');
}

(async () => {
  var targetDateStr = targetMoment.format('YYYY-MM-DD');
  var untilStr = targetMoment.clone().add(1, 'days').format('YYYY-MM-DD');

  var results = await Promise.all(
    _.map(ProductUtil.getAllProductModelClass(), productClass => {
      return sequelize.query(
        sprintf(
          "SELECT product_type_id, count(*) AS count FROM %s WHERE created_at <= :until AND validity_status IN (:validStatusIds) GROUP BY product_type_id;",
          productClass.name
        ),
        {
          replacements: {
            until: untilStr,
            validStatusIds: CONST.VALID_STATUS_IDS,
          },
          type: Sequelize.QueryTypes.SELECT,
        }
      );
    })
  );

  var insertObjects = _.map(_.flatten(results), result => {
    return {
      date: targetDateStr,
      productTypeId: result.product_type_id,
      count: result.count,
    };
  });

  var insertedProductNumModels = await ProductNum.bulkCreate(insertObjects, {
    updateOnDuplicate: ['count', 'created_at'],
  });

  console.log("done!");
})();
