const appRoot = require('app-root-path');
const express = require('express');
const router = express.Router();
const NewTweet = require(appRoot + '/models/new_tweet');
const Moment = require('moment');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');
const TweetCountLog = require(appRoot + '/models/tweet_count_log');

function isAdmin(req, res, next) {
  var email = req.user ? req.user.email : null;

  if (email == Config.admin_gmail_address) {
    return next();
  }
  else {
    res.redirect('/auth');
  }
}

router.get('/', isAdmin, async function (req, res, next) {
  var cacheKeys = __.sortBy(await redis.keys('*'));

  var cacheKeyIntoByteSizeHash = {};

  for (var i = 0; i < cacheKeys.length; i++) {
    var key = cacheKeys[i];
    var value = await redis.get(key);
    cacheKeyIntoByteSizeHash[key] = getBinarySize(value);
  }

  res.render('admin', {
    cacheKeyIntoByteSizeHash: cacheKeyIntoByteSizeHash,
  });
});

router.post('/delete_tweet_and_tweet_count_log', isAdmin, async function (req, res, next) {
  var q = req.body;
  var productId = Number(q.productId);

  if (!productId) {
    return res.send({
      result: false,
    });
  }

  await NewTweet.destroy({
    where: {
      productId: productId,
    }
  });

  await TweetCountLog.destroy({
    where: {
      productId: productId,
    }
  });

  return res.send({
    result: true,
  });
});


router.post('/update_product_validity_status', isAdmin, async function (req, res, next) {
  var q = req.body;
  var productId = q.productId;
  var status = q.status;

  var productModel = (await Util.selectProductModels({
    productId: productId,
  }))[0];

  var updatedProductModel = await productModel.update({
    validityStatus: status,
  });

  res.send({
    result: true,
  });
});

router.post('/update_alt_search_word_validity_status', isAdmin, async function (req, res, next) {
  var q = req.body;
  var productId = q.productId;
  var status = q.status;
  var searchWord = q.searchWord;

  var altSearchWordModel = await TwitterAlternativeSearchWord.findOne({
    where: {
      productId: productId,
      searchWord: searchWord,
    },
  });

  var updatedModel = await altSearchWordModel.update({
    validityStatus: status,
  })

  res.send({
    result: true,
  });
});


router.post('/enable_is_invalid_tweet_flag', isAdmin, async function (req, res, next) {
  var q = req.body;
  var updatedTweetModel = await NewTweet.updateIsInvalid(q.tweetId, true);

  res.send({
    result: true,
  });
});

router.post('/delete_cache', isAdmin, function (req, res, next) {
  var q = req.body;
  var key = q.key;

  redis.del(key);
  console.log("delete cache. key: " + key);

  res.send({
    result: true,
  });
});

module.exports = router;

function getBinarySize(string) {
  return Buffer.byteLength(string, 'utf8');
}
