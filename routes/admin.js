const appRoot = require('app-root-path');
const express = require('express');
const router = express.Router();
const InvalidProductModel = require(appRoot + '/models/invalid_product.js');
const TweetModel = require(appRoot + '/models/tweet');

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
  res.render('admin', {});
});

router.post('/add_product_into_invalid_product_table', isAdmin, function (req, res, next) {
  var q = req.query;

  InvalidProductModel.insert(q.productId)
    .then(() => {
      res.send({
        result: true,
      });
    })
    .fail(() => {
      res.send({
        result: false,
      });
    });
});

router.post('/enable_is_invalid_tweet_flag', isAdmin, function (req, res, next) {
  var q = req.query;

  TweetModel.enableIsInvalidByTweetId(q.tweetId)
    .then(() => {
      res.send({
        result: true,
      });
    })
    .fail(() => {
      res.send({
        result: false,
      });
    });
});

module.exports = router;
