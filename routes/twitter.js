const appRoot = require('app-root-path');
const express = require('express');
const router = express.Router();
const __ = require('underscore');
const CONST = require(appRoot + '/lib/const.js');
const Tweet = require(appRoot + '/models/tweet');
const ProductUtil = require(appRoot + '/lib/product_util.js');
const ProductBundle = require(appRoot + '/models/product_bundle');
const ReleaseControl = require(appRoot + '/models/release_control.js');

router.get('/account/:screenName', async function (req, res, next) {
  var queryString = req.query || {};
  var screenName = req.params.screenName || '';
  var page = queryString.page || 1;
  var latestReleaseControlModel = await ReleaseControl.selectLatest();

  if (!screenName.length) {
    return res.send('screen_name is required to search twitter account');
  }

  var [allTweetModelsWithProductBundleModel, adDataList] = await Promise.all([
    Tweet.findAll({
      where: {
        screenName: screenName
      },
      order: [
        ['tweeted_at', 'DESC'],
      ],
      include: [{
        model: ProductBundle,
        required: false,
      }],
    }),
    ProductUtil.loadSimpleRankingDataList(latestReleaseControlModel.getMoment().format('YYYY-MM-DD')),
  ]);

  var validTweetModels = __.filter(allTweetModelsWithProductBundleModel, m => {
    var productBundleModel = m.product_bundle;
    if (!productBundleModel) return false;
    return productBundleModel.isValid();
  });

  var start = (page - 1) * CONST.TWEET_NUM_PER_PAGE_IN_TWITTER_ACCOUNT_PAGE;
  var end = start + CONST.TWEET_NUM_PER_PAGE_IN_TWITTER_ACCOUNT_PAGE;
  var targetTweetModels = validTweetModels.slice(start, end);
  var productBundleIds = __.pluck(targetTweetModels, 'productBundleId');
  var productBundleIdIntoSearchWordsHash = await ProductUtil.buildProductBundleIdIntoSearchWordsHashByProductBundleIds(productBundleIds);

  res.render('twitter_account', {
    screenName: screenName,
    page: page,
    totalTweetNum: allTweetModelsWithProductBundleModel.length,
    tweetModelsWithProductBundle: targetTweetModels,
    productBundleIdIntoSearchWordsHash: productBundleIdIntoSearchWordsHash,
    adDataList: adDataList,
  });
});

module.exports = router;
