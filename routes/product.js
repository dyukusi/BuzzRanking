const express = require('express');
const router = express.Router();
const Util = require(appRoot + '/my_libs/util.js');
const Tweet = require(appRoot + '/models/tweet');
const BookCaption = require(appRoot + '/models/book_caption');
const TweetCountLog = require(appRoot + '/models/tweet_count_log');
const InvalidProduct = require(appRoot + '/models/invalid_product.js');
const ReleaseControl = require(appRoot + '/models/release_control.js');
const Moment = require('moment');
const memoryCache = require('memory-cache');

router.get('/detail/:product_id', function (req, res, next) {
  var productId = req.params.product_id;

  (async () => {
    // var [statModel, ranking] = ;

    var [productModels, bookCaptionModels, tweetModels, tweetCountLogModels, invalidProductModels, top3RankingData] = await Promise.all([
      await Util.selectProductModelsByProductIds([productId]),
      await BookCaption.selectByProductIds([productId]),
      await Tweet.selectByProductIds([productId]),
      await TweetCountLog.selectByProductId(productId),
      await InvalidProduct.selectByProductIds([productId]),
    ]);

    var targetProductModel = productModels[0];
    var targetBookCaption = bookCaptionModels[0];
    var tweetModelsForDisplay = await Util.sortAndExcludeTweetsForListingTweets(tweetModels);
    var isInvalidProduct = !!invalidProductModels[0];

    var sortedTweetCountLogModels = __.sortBy(tweetCountLogModels, m => {
      return new Moment(m.createdAt).unix();
    });

    var top3RankingData = await getTop3RankingData(targetProductModel.productTypeId);

    res.render('product_detail', {
      productModel: targetProductModel,
      bookCaptionModel: targetBookCaption,
      tweetModels: tweetModelsForDisplay,
      tweetCountLogModels: sortedTweetCountLogModels,
      isInvalidProduct: isInvalidProduct,
      top3RankingData: top3RankingData,

      Moment: Moment,
    });
  })()
    .catch((e) => {
      next(e);
    });
});

async function getTop3RankingData(productTypeId) {
  var releaseControlModel = await ReleaseControl.selectLatestReleaseDate();
  var productTypeBundleId = Const.PRODUCT_TYPE_ID_TO_BELONGED_PRODUCT_TYPE_BUNDLE_ID[productTypeId];
  var targetDateMoment = releaseControlModel.getDateMoment();
  var top3RankingCacheKey = 'ranking_top3_' + productTypeId + '_' + targetDateMoment.format();
  var top3RankingCache = memoryCache.get(top3RankingCacheKey);

  if (top3RankingCache) {
    return top3RankingCache;
  }

  var [statModel, ranking] = await Util.buildRanking([productTypeId], targetDateMoment);
  var top3Ranking = __.first(ranking, 3);

  memoryCache.put(top3RankingCacheKey, top3Ranking);

  return top3Ranking;
}

module.exports = router;
