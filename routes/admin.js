const appRoot = require('app-root-path');
const express = require('express');
const router = express.Router();
const InvalidProductModel = require(appRoot + '/models/invalid_product.js');
const TweetModel = require(appRoot + '/models/tweet');
const Moment = require('moment');
const Util = require(appRoot + '/my_libs/util.js');
const memoryCache = require('memory-cache');

function isAdmin(req, res, next) {
  var email = req.user ? req.user.email : null;

  if (email == Config.admin_gmail_address) {
    return next();
  }
  else {
    res.redirect('/auth');
  }
}

router.get('/', isAdmin, function(req, res, next) {
  res.render('admin', {
    memoryCache: memoryCache,
  });
});

router.post('/add_product_into_invalid_product_table', isAdmin, function (req, res, next) {
  var q = req.query;

  InvalidProductModel.insert(q.productId, 0)
    .then((model) => {
      res.send({
        result: true,
      });
    });
});

router.post('/enable_is_invalid_tweet_flag', isAdmin, function (req, res, next) {
  var q = req.query;

  TweetModel.updateIsInvalid(q.tweetId, true)
    .then((model) => {
      res.send({
        result: true,
      });
    });
});

router.post('/build_ranking', isAdmin, function (req, res, next) {
  var q = req.query;
  var targetMoment = new Moment(q.date);

  res.send({
    result: true,
  });

  (async () => {
    console.log("build ranking request received. Date: " + targetMoment.format());
    var ranking = await Util.buildRankingByDateMoment(targetMoment)
    console.log("build ranking completed! Date: " + targetMoment.format());
  })();
});

router.post('/delete_cache', isAdmin, function (req, res, next) {
  var q = req.query;
  var key = q.key;

  memoryCache.del(key);
  console.log("delete cache. key: " + key);

  res.send({
    result: true,
  });
});

module.exports = router;
