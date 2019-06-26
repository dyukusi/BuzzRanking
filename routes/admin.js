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

module.exports = router;
