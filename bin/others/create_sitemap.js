var appRoot = require('app-root-path');
const fs = require('fs');
var ejs = require('ejs');
var SiteMapBase = fs.readFileSync(appRoot + '/views/sitemap_base.ejs', 'utf8');
var _ = require('underscore');
const CONST = require(appRoot + '/my_libs/const.js');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const sprintf = require('sprintf-js').sprintf;
const Moment = require('moment');

// NOTE: GOOGLE IS NO LONGER CONSIDERS PRIORITY VALUE
const PRIORITY_OF = {
  POPULAR: 0.8,
  NORMAL: 0.3,
  INVALID: 0.1,
};

const LAST_MOD_PRODUCT_DETIAIL_PAGE = new Moment('2019-11-07').format("YYYY-MM-DD");

main()
  .then(() => {
    sequelize.close();
    console.log("finish");
  });


async function main() {
  // for judge is popular
  var ProductReferredByUsersRows = (await sequelize.query(
    "SELECT product_id FROM (SELECT product_id, count(*) AS count FROM new_tweet GROUP BY product_id) AS t2 WHERE count > 30",
  ))[0];

  // var productIdToIsPopularHash = {};
  // _.each(rankInProductIdRows, rankInProductIdRow => {
  //   productIdToIsPopularHash[rankInProductIdRow.product_id] = true;
  // });

  // fetch all product ids
  // var productIds = [];
  // for (var i = 0; i < CONST.PRODUCT_MODELS.length; i++) {
  //   var modelClass = CONST.PRODUCT_MODELS[i];
  //
  //   let productIdRows = (await sequelize.query(
  //     sprintf(
  //       "SELECT product_id FROM %s;",
  //       modelClass,
  //     )
  //   ))[0];
  //
  //   let newProductIds = _.map(productIdRows, productIdRow => {
  //     return productIdRow.product_id;
  //   });
  //
  //   productIds = _.compact(_.flatten([productIds, newProductIds]));
  // }

  // set priority
  var productDataset = _.map(ProductReferredByUsersRows, rankInProductIdRow => {
    return {
      productId: rankInProductIdRow.product_id,
      priority: PRIORITY_OF.POPULAR,
    };
  });

  var sitemap = ejs.render(SiteMapBase, {
    productDataset: productDataset,
    productDetailLastModStr: LAST_MOD_PRODUCT_DETIAIL_PAGE,
    CONST: CONST,
    _: _,
  });

  var fspromise = new Promise(function(resolve, reject) {
    fs.writeFile(appRoot + '/public/sitemap.xml', sitemap, function(err) {
      if (err) reject(err);
      else resolve('ok');
    });
  });

  var fsResult = await fspromise;

  return 0;
}




