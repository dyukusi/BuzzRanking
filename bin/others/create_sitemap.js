var appRoot = require('app-root-path');
const fs = require('fs');
var ejs = require('ejs');
var SiteMapBase = fs.readFileSync(appRoot + '/views/sitemap_base.ejs', 'utf8');
var _ = require('underscore');
const InvalidProduct = require(appRoot + '/models/invalid_product.js');
const CONST = require(appRoot + '/my_libs/const.js');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const sprintf = require('sprintf-js').sprintf;
const PRIORITY_OF = {
  POPULAR: 0.9,
  NORMAL: 0.8,
  INVALID: 0.7,
};

main()
  .then(() => {
    sequelize.close();
    console.log("finish");
  });


async function main() {
  // for judge is invalid
  var invalidProductModels = await InvalidProduct.findAll({});
  var productIdToIsInvalidHash = {};
  _.each(invalidProductModels, m => {
    productIdToIsInvalidHash[m.productId] = true;
  });

  // for judge is popular
  var rankInProductIdRows = (await sequelize.query(
    "SELECT product_id, count(*) FROM stat_data GROUP BY product_id;",
  ))[0];
  var productIdToIsPopularHash = {};
  _.each(rankInProductIdRows, rankInProductIdRow => {
    productIdToIsPopularHash[rankInProductIdRow.product_id] = true;
  });

  // fetch all product ids
  var productIds = [];
  for (var i = 0; i < CONST.PRODUCT_TABLE_NAMES.length; i++) {
    var tableName = CONST.PRODUCT_TABLE_NAMES[i];

    let productIdRows = (await sequelize.query(
      sprintf(
        "SELECT product_id FROM %s;",
        tableName,
      )
    ))[0];

    let newProductIds = _.map(productIdRows, productIdRow => {
      return productIdRow.product_id;
    });

    productIds = _.compact(_.flatten([productIds, newProductIds]));
  }

  // set priority
  var productDataset = _.map(productIds, productId => {
    var priority = PRIORITY_OF.NORMAL;

    if (productIdToIsPopularHash[productId]) {
      priority = PRIORITY_OF.POPULAR;
    }

    if (productIdToIsInvalidHash[productId]) {
      priority = PRIORITY_OF.INVALID;
    }

    return {
      productId: productId,
      priority: priority,
    };
  });

  var sitemap = ejs.render(SiteMapBase, {
    productDataset: productDataset,
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




