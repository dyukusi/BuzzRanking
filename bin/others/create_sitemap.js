const appRoot = require('app-root-path');
const fs = require('fs');
const ejs = require('ejs');
const sequelize = require(appRoot + '/db/sequelize_config');
const ProductBundle = require(appRoot + '/models/product_bundle');
const _ = require('underscore');
const CONST = require(appRoot + '/lib/const.js');

main()
  .then(() => {
    sequelize.close();
    console.log("finish");
  });

async function main() {
  var SiteMapBase = fs.readFileSync(appRoot + '/views/sitemap_base.ejs', 'utf8');

  var productBundleIdIntoLastUpdatedAtHash = {};

  var productBundleIdAndLastUpdatedAtRows = await sequelize.query(
    'SELECT product_bundle_id AS productBundleId, MAX(date) AS lastRecordedAt FROM product_tweet_stat WHERE product_bundle_id IN (SELECT id AS productBundleId FROM product_bundle WHERE id IN (SELECT DISTINCT product_bundle_id FROM product_tweet_stat WHERE tweet_count >= 0)) GROUP BY product_bundle_id;',
    {
      replacements: {},
      type: sequelize.QueryTypes.SELECT,
    }
  );

  _.each(productBundleIdAndLastUpdatedAtRows, row => {
    productBundleIdIntoLastUpdatedAtHash[row.productBundleId] = row.lastRecordedAt;
  });

  var productBundleIdAndLastTweetCollectedAtRows = await sequelize.query(
    'SELECT product_bundle_id AS productBundleId, MAX(created_at) AS lastTweetCollectedAt FROM tweet_count_log GROUP BY product_bundle_id;',
    {
      replacements: {},
      type: sequelize.QueryTypes.SELECT,
    }
  );

  _.each(productBundleIdAndLastTweetCollectedAtRows, row => {
    if (!productBundleIdIntoLastUpdatedAtHash[row.productBundleId]) {
      productBundleIdIntoLastUpdatedAtHash[row.productBundleId] = row.lastTweetCollectedAt;
    }
  });

  var allProductBundleIds = _.keys(productBundleIdIntoLastUpdatedAtHash);
  var productBundleModels = await ProductBundle.findAll({
    where: {
      id: allProductBundleIds,
      validityStatus: CONST.VALID_STATUS_IDS,
    },
  });
  var targetProductBundleIds = _.pluck(productBundleModels, 'id');

  console.log(targetProductBundleIds.length + " bundles were found");

  var rankingLastUpdatedAtDateStr = await (async () => {
    var row = (await sequelize.query(
      'SELECT MAX(date) AS date FROM release_control',
      {
        replacements: {},
        type: sequelize.QueryTypes.SELECT,
      }
    ))[0];

    return row.date;
  })();

  var sitemap = ejs.render(SiteMapBase, {
    targetProductBundleIds,
    productBundleIdIntoLastUpdatedAtHash,
    rankingLastUpdatedAtDateStr,

    require: require,
  }).trim();

  var fspromise = new Promise(function(resolve, reject) {
    fs.writeFile(appRoot + '/public/sitemap.xml', sitemap, function(err) {
      if (err) reject(err);
      else resolve('ok');
    });
  });

  var fsResult = await fspromise;
}
