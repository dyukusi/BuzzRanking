const appRoot = require('app-root-path');
const fs = require('fs');
const ejs = require('ejs');
const sequelize = require(appRoot + '/db/sequelize_config');

main()
  .then(() => {
    sequelize.close();
    console.log("finish");
  });

async function main() {
  var SiteMapBase = fs.readFileSync(appRoot + '/views/sitemap_base.ejs', 'utf8');

  var productBundleIdAndLastUpdatedAtRows = await sequelize.query(
    'SELECT product_bundle_id AS productBundleId, MAX(date) AS lastUpdatedAt FROM product_tweet_stat WHERE product_bundle_id IN (SELECT id AS productBundleId FROM product_bundle WHERE id IN (SELECT DISTINCT product_bundle_id FROM product_tweet_stat WHERE tweet_count >= 1)) GROUP BY product_bundle_id;',
    {
      replacements: {},
      type: sequelize.QueryTypes.SELECT,
    }
  );

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
    productBundleIdAndLastUpdatedAtRows,
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
