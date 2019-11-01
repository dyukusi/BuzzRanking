const appRoot = require('app-root-path');
const express = require('express');
const router = express.Router();
const NewTweet = require(appRoot + '/models/new_tweet');
const cacheUtil = require(appRoot + '/my_libs/cache_util.js');
const Moment = require('moment');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');
const BlockTwitterUser = require(appRoot + '/models/block_twitter_user');

function isAdmin(req, res, next) {
  var email = req.user ? req.user.email : null;

  if (email == Config.admin_gmail_address) {
    return next();
  }
  else {
    res.redirect('/auth');
  }
}

router.get('/product/tweet_list', async function (req, res, next) {
  var q = req.query;
  var productId = Number(q.productId);
  var cacheKey = cacheUtil.generateTweetDataListForProductDetailPageCacheKey(productId);
  var cache = await redis.get(cacheKey);
  if (cache) {
    res.send(cache);
    return;
  }

  console.log("cache miss: " + cacheKey);

  var productModel = (await Util.selectProductModels({
    productId: productId,
  }))[0];

  var [tweetModels, blockTwitterUserModels] = await Promise.all([
    NewTweet.findAll({
      where: {
        productId: productId,
      },
      order: [
        ['tweetedAt', 'DESC']
      ],
      limit: 500,
    }),
    BlockTwitterUser.findAll(),
  ]);

  var screenNameToBlockTwitterUserModelHash = __.indexBy(blockTwitterUserModels, m => {
    return m.screenName;
  });

  var modifiedTweetModels = await Util.sortAndFilterTweetModels(tweetModels, {
    limitNumAfterModify: 250,
    prioritizeFirstAppearUserTweet: true,
    deprioritizeBlockedUser: true,
    deprioritizeContainsSpecificWordsInText: true,
    screenNameToBlockTwitterUserModelHash: screenNameToBlockTwitterUserModelHash,
    productModel: productModel,
    prioritizeContainProductNameInText: true,
    deprioritizeByNewLineCharCount: 9,
  });

  var tweetDataListForProductDetailPage = __.map(modifiedTweetModels, m => {
    return [m.screenName, m.id, m.text];
  });

  var serializedTweetDataListForProductDetailPage = JSON.stringify(tweetDataListForProductDetailPage);
  redis.set(cacheKey, serializedTweetDataListForProductDetailPage, "EX", (60 * 60) * 6); // 6 hours cache

  res.send(serializedTweetDataListForProductDetailPage);
});

module.exports = router;
